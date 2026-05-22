package handlers

import (
	"net/http"

	"github.com/abhishekkkk-15/infra-cd/api/internal/http/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// TriggerDeployment handles POST /projects/:id/deployments
func TriggerDeployment(c *gin.Context) {
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id"})
		return
	}
	deployment, err := services.TriggerDeployment(projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, deployment)
}

// ListDeployments handles GET /projects/:id/deployments
func ListDeployments(c *gin.Context) {
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id"})
		return
	}
	deployments, err := services.ListDeploymentsByProject(projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, deployments)
}

// GetDeployment handles GET /deployments/:id
func GetDeployment(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid deployment id"})
		return
	}
	deployment, err := services.GetDeploymentByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "deployment not found"})
		return
	}
	c.JSON(http.StatusOK, deployment)
}

// StreamDeploymentLogs handles GET /deployments/:id/logs/stream (SSE)
func StreamDeploymentLogs(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid deployment id"})
		return
	}
	services.StreamLogs(c, id)
}

// UpdateDeploymentStatus handles PATCH /deployments/:id/status  (called by agent)
func UpdateDeploymentStatus(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid deployment id"})
		return
	}
	var body struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := services.UpdateDeploymentStatus(id, body.Status); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

// CreateDeploymentStep handles POST /deployments/:id/steps (called by agent)
func CreateDeploymentStep(c *gin.Context) {
	deploymentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid deployment id"})
		return
	}
	var body struct {
		Name    string `json:"name" binding:"required"`
		Command string `json:"command"`
		Status  string `json:"status" binding:"required"`
		Order   int    `json:"order"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	step, err := services.CreateDeploymentStep(deploymentID, body.Name, body.Command, body.Status, body.Order)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, step)
}

// UpdateDeploymentStep handles PATCH /deployments/:id/steps/:stepId (called by agent)
func UpdateDeploymentStep(c *gin.Context) {
	stepID, err := uuid.Parse(c.Param("stepId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid step id"})
		return
	}
	var body struct {
		Status string `json:"status"`
		Output string `json:"output"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := services.UpdateDeploymentStep(stepID, body.Status, body.Output); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

// AppendDeploymentLog handles POST /deployments/:id/logs  (called by agent)
func AppendDeploymentLog(c *gin.Context) {
	deploymentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid deployment id"})
		return
	}
	var body struct {
		Message string `json:"message" binding:"required"`
		Type    string `json:"type"` // stdout | stderr
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if body.Type == "" {
		body.Type = "stdout"
	}
	if err := services.AppendLog(deploymentID, body.Message, body.Type); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"status": "logged"})
}

// GetPendingDeployments handles GET /agents/:id/pending-deployments (polled by agent)
func GetPendingDeployments(c *gin.Context) {
	agentID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid agent id"})
		return
	}
	// Verify agent still exists
	if _, err := services.GetAgentByIDSystem(agentID); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "agent not found or deleted"})
		return
	}

	deployments, err := services.GetPendingDeploymentsForAgent(agentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, deployments)
}

// TriggerDeploymentWebhook handles POST /deployments/webhook/trigger (Public endpoint)
func TriggerDeploymentWebhook(c *gin.Context) {
	var body struct {
		ProjectID uuid.UUID `json:"project_id" binding:"required"`
		Token     string    `json:"token" binding:"required"`
		Branch    string    `json:"branch"`
		CommitSHA string    `json:"commit_sha"`
	}

	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	deployment, err := services.TriggerDeploymentWithToken(body.ProjectID, body.Token, body.Branch, body.CommitSHA)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, deployment)
}
