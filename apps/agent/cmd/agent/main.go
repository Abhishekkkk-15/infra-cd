package main

import (
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/mem"

	"github.com/abhishekkkk-15/infra-cd/agent/internal/client"
	"github.com/abhishekkkk-15/infra-cd/agent/internal/runner"
)

func main() {
	token := flag.String("token", "", "Agent authentication token")
	serverURL := flag.String("server", "http://localhost:8080", "API server URL")
	flag.Parse()

	// Environment variable fallbacks
	if *token == "" {
		*token = os.Getenv("INFRA_AGENT_TOKEN")
	}
	if os.Getenv("INFRA_SERVER_URL") != "" {
		*serverURL = os.Getenv("INFRA_SERVER_URL")
	}

	if *token == "" {
		log.Fatal("Error: --token is required or INFRA_AGENT_TOKEN must be set.")
	}

	fmt.Printf("Starting Infra-CD Agent...\n")
	fmt.Printf("Server URL: %s\n", *serverURL)

	apiClient := client.NewClient(*serverURL, *token)

	// 1. Verify Agent Token (HTTP)
	agent, err := apiClient.VerifyAgent()
	if err != nil {
		if errors.Is(err, client.ErrInvalidToken) {
			log.Println("Agent token is invalid or revoked. Please re-register this agent from the dashboard.")
			log.Println("Stopping agent to prevent restart loop.")
			os.Exit(0)
		}
		log.Fatalf("Failed to verify agent: %v", err)
	}
	fmt.Printf("✓ Agent verified: %s (ID: %s)\n", agent.Name, agent.ID)

	// 2. Connect WebSocket
	wsClient := client.NewWSClient(*serverURL, agent.ID, *token)
	apiClient.WS = wsClient // Attach WS client to API client
	wsClient.ConnectWithRetry()

	// Callback when WebSocket pushes a "new_deployment" message
	wsClient.OnDeploymentTriggered = func(deploymentID string) {
		log.Printf("Received instant deployment notification via WS: %s", deploymentID)
		
		// Wait a small bit in case the DB transaction on the server hasn't committed yet
		time.Sleep(200 * time.Millisecond)

		deployments, err := apiClient.GetPendingDeployments(agent.ID)
		if err != nil {
			log.Printf("Failed to fetch pending deployments after WS trigger: %v", err)
			return
		}

		for _, d := range deployments {
			if d.ID != deploymentID {
				continue
			}

			fmt.Printf("\n[Job Picked] Deployment %s for Project %s\n", d.ID, d.ProjectID)
			
			// Update status to running (this now streams over WS)
			_ = apiClient.UpdateDeploymentStatus(d.ID, "running")

			// Execute the deployment!
			err := runner.RunDeployment(apiClient, d)
			
			if err != nil {
				log.Printf("Deployment %s failed: %v", d.ID, err)
				_ = apiClient.UpdateDeploymentStatus(d.ID, "failed")
			} else {
				log.Printf("Deployment %s completed successfully", d.ID)
				_ = apiClient.UpdateDeploymentStatus(d.ID, "success")
			}
		}
	}

	// 3. Start heartbeat goroutine (Streams over WS)
	go func() {
		for {
			var cpuUsage float64
			if percentages, err := cpu.Percent(time.Second, false); err == nil && len(percentages) > 0 {
				cpuUsage = percentages[0]
			}
			var ramUsage float64
			if v, err := mem.VirtualMemory(); err == nil {
				ramUsage = v.UsedPercent
			}

			// Pushes heartbeat async via WS client
			_ = apiClient.SendHeartbeat(agent.ID, cpuUsage, ramUsage)

			time.Sleep(15 * time.Second)
		}
	}()

	// 4. Initial Fetch (just in case there are pending jobs on boot)
	go func() {
		deployments, err := apiClient.GetPendingDeployments(agent.ID)
		if err == nil {
			for _, d := range deployments {
				wsClient.OnDeploymentTriggered(d.ID)
			}
		}
	}()

	// Block forever (WS ReadPump keeps alive)
	fmt.Println("Listening for deployments via WebSocket...")
	select {}
}
