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
	"github.com/abhishekkkk-15/infra-cd/api/internal/ws"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// TriggerDeployment creates a new deployment record and launches the runner asynchronously.
func TriggerDeployment(projectID uuid.UUID) (models.Deployment, error) {
	return TriggerDeploymentWithCommit(projectID, "", "", "", false)
}

// TriggerDeploymentWithCommit creates a new deployment record with commit info and launches the runner.
func TriggerDeploymentWithCommit(projectID uuid.UUID, commitSHA, commitMsg, rollbackFromCommit string, isAutoRollback bool) (models.Deployment, error) {
	// Verify project exists
	var project models.Project
	if err := db.DB.First(&project, "id = ?", projectID).Error; err != nil {
		return models.Deployment{}, fmt.Errorf("project not found: %w", err)
	}

	d := models.Deployment{
		ProjectID:          projectID,
		Status:             models.DeploymentPending,
		Branch:             project.Branch,
		CommitSHA:          commitSHA,
		CommitMessage:      commitMsg,
		RollbackFromCommit: rollbackFromCommit,
		IsAutoRollback:     isAutoRollback,
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
	} else {
		// Notify the agent instantly via WebSocket
		_ = ws.DefaultManager.PushToAgent(*d.AgentID, ws.Message{
			Type:    "new_deployment",
			Payload: map[string]string{"deployment_id": d.ID.String()},
		})
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
	} else {
		_ = ws.DefaultManager.PushToAgent(*d.AgentID, ws.Message{
			Type:    "new_deployment",
			Payload: map[string]string{"deployment_id": d.ID.String()},
		})
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
	err := db.DB.Model(&models.Deployment{}).Where("id = ?", id).Updates(updates).Error
	if err != nil {
		return err
	}

	// Auto-Rollback logic
	if s == models.DeploymentFailed {
		go func() {
			var d models.Deployment
			if err := db.DB.Preload("Project").First(&d, "id = ?", id).Error; err != nil {
				return
			}
			if !d.Project.AutoRollback || d.IsAutoRollback {
				return // Disabled or we just failed an auto-rollback (prevent loop)
			}

			// Find last successful deployment
			var lastSuccess models.Deployment
			err := db.DB.Where("project_id = ? AND status = ? AND id != ?", d.ProjectID, models.DeploymentSuccess, id).
				Order("created_at desc").
				First(&lastSuccess).Error
			
			if err == nil {
				_, _ = RollbackDeployment(lastSuccess.ID, d.CommitSHA, true)
			}
		}()
	}

	return nil
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

func CreateDeploymentStepWithID(id string, deploymentID uuid.UUID, name, command, status string, order int) (models.DeploymentStep, error) {
	step := models.DeploymentStep{
		DeploymentID: deploymentID,
		Name:         name,
		Command:      command,
		Status:       models.StepStatus(status),
		Order:        order,
	}
	if parsedID, err := uuid.Parse(id); err == nil {
		step.ID = parsedID
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

// ReportPipelineConfig updates the associated project's pipeline_config in the database.
func ReportPipelineConfig(deploymentID uuid.UUID, config string) error {
	var deployment models.Deployment
	if err := db.DB.Preload("Project").First(&deployment, "id = ?", deploymentID).Error; err != nil {
		return err
	}
	return db.DB.Model(&deployment.Project).Update("pipeline_config", config).Error
}

// RollbackDeployment triggers a new deployment matching the commit and branch of a past deployment.
func RollbackDeployment(id uuid.UUID, rollbackFromCommit string, isAuto bool) (models.Deployment, error) {
	var oldDeployment models.Deployment
	if err := db.DB.Preload("Project").First(&oldDeployment, "id = ?", id).Error; err != nil {
		return models.Deployment{}, fmt.Errorf("deployment not found: %w", err)
	}

	prefix := "Rollback"
	if isAuto {
		prefix = "Auto-Rollback"
	}

	msg := fmt.Sprintf("%s to commit %.8s: %s", prefix, oldDeployment.CommitSHA, oldDeployment.CommitMessage)
	if oldDeployment.CommitSHA == "" || oldDeployment.CommitSHA == "HEAD" {
		msg = fmt.Sprintf("%s to manual trigger: %s", prefix, oldDeployment.CommitMessage)
	}

	return TriggerDeploymentWithCommit(oldDeployment.ProjectID, oldDeployment.CommitSHA, msg, rollbackFromCommit, isAuto)
}
