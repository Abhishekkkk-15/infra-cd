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

	// 1. Verify Agent Token
	agent, err := apiClient.VerifyAgent()
	if err != nil {
		log.Fatalf("Failed to verify agent: %v", err)
	}
	fmt.Printf("✓ Agent verified: %s (ID: %s)\n", agent.Name, agent.ID)

	// shutdown is closed when the agent detects it has been deregistered.
	shutdown := make(chan struct{})

	// 2. Start heartbeat goroutine
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

			err := apiClient.SendHeartbeat(agent.ID, cpuUsage, ramUsage)
			if err != nil {
				if errors.Is(err, client.ErrAgentDeregistered) {
					log.Println("Agent has been removed from the server. Shutting down.")
					close(shutdown)
					return
				}
				log.Printf("Heartbeat failed: %v", err)
			}
			time.Sleep(15 * time.Second)
		}
	}()

	// 3. Main Poll Loop
	fmt.Println("Listening for pending deployments...")
	for {
		// Check if shutdown was signalled by heartbeat goroutine
		select {
		case <-shutdown:
			log.Println("Shutdown signal received. Exiting.")
			os.Exit(0)
		default:
		}

		deployments, err := apiClient.GetPendingDeployments(agent.ID)
		if err != nil {
			if errors.Is(err, client.ErrAgentDeregistered) {
				log.Println("Agent has been removed from the server. Shutting down.")
				os.Exit(0)
			}
			log.Printf("Failed to poll deployments: %v", err)
			time.Sleep(5 * time.Second)
			continue
		}

		for _, d := range deployments {
			fmt.Printf("\n[Job Picked] Deployment %s for Project %s\n", d.ID, d.ProjectID)
			
			// Update status to running
			apiClient.UpdateDeploymentStatus(d.ID, "running")

			// Execute the deployment!
			err := runner.RunDeployment(apiClient, d)
			
			if err != nil {
				log.Printf("Deployment %s failed: %v", d.ID, err)
				apiClient.UpdateDeploymentStatus(d.ID, "failed")
			} else {
				log.Printf("Deployment %s completed successfully", d.ID)
				apiClient.UpdateDeploymentStatus(d.ID, "success")
			}
		}

		time.Sleep(5 * time.Second)
	}
}
