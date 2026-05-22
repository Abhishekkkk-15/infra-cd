package services

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/abhishekkkk-15/infra-cd/api/internal/db"
	"github.com/abhishekkkk-15/infra-cd/api/internal/db/models"
	"github.com/abhishekkkk-15/infra-cd/api/internal/deployment"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// TriggerDeployment creates a new deployment record and launches the runner asynchronously.
func TriggerDeployment(projectID uuid.UUID) (models.Deployment, error) {
	return TriggerDeploymentWithCommit(projectID, "", "")
}

// TriggerDeploymentWithCommit creates a new deployment record with commit info and launches the runner.
func TriggerDeploymentWithCommit(projectID uuid.UUID, commitSHA, commitMsg string) (models.Deployment, error) {
	// Verify project exists
	var project models.Project
	if err := db.DB.First(&project, "id = ?", projectID).Error; err != nil {
		return models.Deployment{}, fmt.Errorf("project not found: %w", err)
	}

	d := models.Deployment{
		ProjectID:     projectID,
		Status:        models.DeploymentPending,
		Branch:        project.Branch,
		CommitSHA:     commitSHA,
		CommitMessage: commitMsg,
	}

	if project.AgentID != nil {
		// Pin to specific agent
		d.AgentID = project.AgentID
	} else {
		// Try to pick an online agent from the pool
		var agent models.Agent
		if err := db.DB.Where("status = ?", models.AgentOnline).First(&agent).Error; err == nil {
			d.AgentID = &agent.ID
		}
	}

	if err := db.DB.Create(&d).Error; err != nil {
		return d, err
	}

	// Only launch internal legacy runner if no agent is assigned.
	// Otherwise, let the assigned external agent pull it from the queue.
	if d.AgentID == nil {
		go deployment.Run(d.ID)
	}

	return d, nil
}

// TriggerDeploymentWithToken verifies project ID and deploy token, creates a deployment, and starts it.
func TriggerDeploymentWithToken(projectID uuid.UUID, token string, branch string, commitSHA string) (models.Deployment, error) {
	var project models.Project
	if err := db.DB.First(&project, "id = ? AND deploy_token = ?", projectID, token).Error; err != nil {
		return models.Deployment{}, fmt.Errorf("invalid project ID or deploy token: %w", err)
	}

	deployBranch := branch
	if deployBranch == "" {
		deployBranch = project.Branch
	}

	d := models.Deployment{
		ProjectID: projectID,
		Status:    models.DeploymentPending,
		Branch:    deployBranch,
		CommitSHA: commitSHA,
	}

	if project.AgentID != nil {
		d.AgentID = project.AgentID
	} else {
		var agent models.Agent
		if err := db.DB.Where("status = ?", models.AgentOnline).First(&agent).Error; err == nil {
			d.AgentID = &agent.ID
		}
	}

	if err := db.DB.Create(&d).Error; err != nil {
		return d, err
	}

	if d.AgentID == nil {
		go deployment.Run(d.ID)
	}

	return d, nil
}

func ListDeploymentsByProject(projectID uuid.UUID) ([]models.Deployment, error) {
	var deployments []models.Deployment
	err := db.DB.
		Where("project_id = ?", projectID).
		Order("created_at DESC").
		Find(&deployments).Error
	return deployments, err
}

func GetDeploymentByID(id uuid.UUID) (models.Deployment, error) {
	var d models.Deployment
	err := db.DB.
		Preload("Steps").
		First(&d, "id = ?", id).Error
	return d, err
}

func UpdateDeploymentStatus(id uuid.UUID, status string) error {
	s := models.DeploymentStatus(status)
	updates := map[string]interface{}{"status": s}
	if s == models.DeploymentRunning {
		now := time.Now()
		updates["started_at"] = now
	}
	if s == models.DeploymentSuccess || s == models.DeploymentFailed {
		now := time.Now()
		updates["finished_at"] = now
	}
	return db.DB.Model(&models.Deployment{}).Where("id = ?", id).Updates(updates).Error
}

func CreateDeploymentStep(deploymentID uuid.UUID, name, command, status string, order int) (models.DeploymentStep, error) {
	step := models.DeploymentStep{
		DeploymentID: deploymentID,
		Name:         name,
		Command:      command,
		Status:       models.StepStatus(status),
		Order:        order,
	}
	err := db.DB.Create(&step).Error
	return step, err
}

func UpdateDeploymentStep(stepID uuid.UUID, status, output string) error {
	return db.DB.Model(&models.DeploymentStep{}).
		Where("id = ?", stepID).
		Updates(map[string]interface{}{
			"status": status,
			"output": output,
		}).Error
}

func AppendLog(deploymentID uuid.UUID, message, logType string) error {
	logEntry := models.DeploymentLog{
		DeploymentID: deploymentID,
		Message:      message,
		Type:         models.LogType(logType),
	}
	return db.DB.Create(&logEntry).Error
}

// GetPendingDeploymentsForAgent returns deployments in pending state assigned to this agent.
func GetPendingDeploymentsForAgent(agentID uuid.UUID) ([]models.Deployment, error) {
	var deployments []models.Deployment
	err := db.DB.
		Preload("Project").
		Where("agent_id = ? AND status = ?", agentID, models.DeploymentPending).
		Find(&deployments).Error
	return deployments, err
}

// StreamLogs writes deployment logs as Server-Sent Events until deployment finishes.
func StreamLogs(c *gin.Context, deploymentID uuid.UUID) {
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Access-Control-Allow-Origin", "*")

	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	clientGone := c.Request.Context().Done()

	// Track how many logs we've already sent using offset
	var offset int64 = 0

	c.Stream(func(w io.Writer) bool {
		select {
		case <-clientGone:
			return false
		case <-ticker.C:
			// Fetch only new logs using offset
			var logs []models.DeploymentLog
			db.DB.
				Where("deployment_id = ?", deploymentID).
				Order("created_at ASC").
				Offset(int(offset)).
				Find(&logs)

			for _, l := range logs {
				data, _ := json.Marshal(gin.H{"message": l.Message, "type": l.Type})
				fmt.Fprintf(w, "event: log\ndata: %s\n\n", data)
				offset++
			}

			// Flush to push data to client immediately
			if f, ok := w.(http.Flusher); ok {
				f.Flush()
			}

			// Check if deployment is done
			var d models.Deployment
			if err := db.DB.Select("status").First(&d, "id = ?", deploymentID).Error; err == nil {
				if d.Status == models.DeploymentSuccess || d.Status == models.DeploymentFailed {
					data, _ := json.Marshal(gin.H{"status": d.Status})
					fmt.Fprintf(w, "event: done\ndata: %s\n\n", data)
					return false
				}
			}
			return true
		}
	})
}
