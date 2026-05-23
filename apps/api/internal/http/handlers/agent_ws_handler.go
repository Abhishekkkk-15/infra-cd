package handlers

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/abhishekkkk-15/infra-cd/api/internal/http/services"
	"github.com/abhishekkkk-15/infra-cd/api/internal/ws"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow agents from anywhere
	},
}

// AgentWSHandler upgrades the HTTP connection to a WebSocket for the agent
func AgentWSHandler(c *gin.Context) {
	agentIDStr := c.Param("id")
	agentID, err := uuid.Parse(agentIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid agent id"})
		return
	}

	// Verify agent token (provided in header or query)
	token := c.GetHeader("Authorization")
	if token == "" {
		token = c.Query("token")
	} else if len(token) > 7 && token[:7] == "Bearer " {
		token = token[7:]
	}

	if token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing token"})
		return
	}

	agent, err := services.GetAgentByIDSystem(agentID)
	if err != nil || agent.Token != token {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token or agent not found"})
		return
	}

	// Upgrade connection
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		slog.Error("Failed to upgrade to websocket", "error", err)
		return
	}

	// Register with manager
	ws.DefaultManager.Register(agentID, conn)

	// Start reading pump to handle incoming messages from agent
	go readPump(agentID, conn)
}

func readPump(agentID uuid.UUID, conn *websocket.Conn) {
	defer func() {
		ws.DefaultManager.Unregister(agentID)
		conn.Close()
	}()

	for {
		_, messageData, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				slog.Error("Unexpected websocket close error", "error", err)
			}
			break
		}

		var msg ws.Message
		if err := json.Unmarshal(messageData, &msg); err != nil {
			slog.Error("Failed to decode websocket message", "error", err)
			continue
		}

		handleAgentMessage(agentID, msg)
	}
}

func handleAgentMessage(agentID uuid.UUID, msg ws.Message) {
	// Parse payload back to JSON bytes to unmarshal into specific structs
	payloadBytes, _ := json.Marshal(msg.Payload)

	switch msg.Type {
	case "heartbeat":
		var p struct {
			CPUUsage float64 `json:"cpuUsage"`
			RAMUsage float64 `json:"ramUsage"`
		}
		if err := json.Unmarshal(payloadBytes, &p); err == nil {
			_ = services.RecordHeartbeat(agentID, p.CPUUsage, p.RAMUsage)
		}

	case "status_update":
		var p struct {
			DeploymentID string `json:"deployment_id"`
			Status       string `json:"status"`
		}
		if err := json.Unmarshal(payloadBytes, &p); err == nil {
			if did, err := uuid.Parse(p.DeploymentID); err == nil {
				_ = services.UpdateDeploymentStatus(did, p.Status)
			}
		}

	case "log_append":
		var p struct {
			DeploymentID string `json:"deployment_id"`
			Message      string `json:"message"`
			Type         string `json:"type"`
		}
		if err := json.Unmarshal(payloadBytes, &p); err == nil {
			if p.Type == "" {
				p.Type = "stdout"
			}
			if did, err := uuid.Parse(p.DeploymentID); err == nil {
				_ = services.AppendLog(did, p.Message, p.Type)
			}
		}

	case "step_create":
		var p struct {
			ID           string `json:"id"`
			DeploymentID string `json:"deployment_id"`
			Name         string `json:"name"`
			Command      string `json:"command"`
			Status       string `json:"status"`
			Order        int    `json:"order"`
		}
		if err := json.Unmarshal(payloadBytes, &p); err == nil {
			if did, err := uuid.Parse(p.DeploymentID); err == nil {
				// Create deployment step
				_, _ = services.CreateDeploymentStepWithID(p.ID, did, p.Name, p.Command, p.Status, p.Order)
			}
		}

	case "step_update":
		var p struct {
			StepID string `json:"step_id"`
			Status string `json:"status"`
			Output string `json:"output"`
		}
		if err := json.Unmarshal(payloadBytes, &p); err == nil {
			if sid, err := uuid.Parse(p.StepID); err == nil {
				_ = services.UpdateDeploymentStep(sid, p.Status, p.Output)
			}
		}

	case "pipeline_config_report":
		var p struct {
			DeploymentID string `json:"deployment_id"`
			Config       string `json:"pipeline_config"`
		}
		if err := json.Unmarshal(payloadBytes, &p); err == nil {
			if did, err := uuid.Parse(p.DeploymentID); err == nil {
				_ = services.ReportPipelineConfig(did, p.Config)
			}
		}

	default:
		slog.Warn("Unknown websocket message type", "type", msg.Type)
	}
}
