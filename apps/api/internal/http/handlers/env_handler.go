package handlers

import (
	"net/http"

	"github.com/abhishekkkk-15/infra-cd/api/internal/db/models"
	"github.com/abhishekkkk-15/infra-cd/api/internal/http/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ListEnvVars handles GET /projects/:id/env
func ListEnvVars(c *gin.Context) {
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id"})
		return
	}
	envVars, err := services.ListEnvVars(projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, envVars)
}

// ListEnvVarsAgent handles GET /agents/projects/:projectId/env
func ListEnvVarsAgent(c *gin.Context) {
	// Verify Agent Token for security
	token := c.GetHeader("Authorization")
	if len(token) > 7 && token[:7] == "Bearer " {
		token = token[7:]
	}
	if _, err := services.VerifyAgent(token); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid agent token"})
		return
	}

	projectID, err := uuid.Parse(c.Param("projectId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id"})
		return
	}
	envVars, err := services.ListEnvVars(projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, envVars)
}

// CreateEnvVar handles POST /projects/:id/env
func CreateEnvVar(c *gin.Context) {
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id"})
		return
	}
	var envVar models.EnvironmentVariable
	if err := c.ShouldBindJSON(&envVar); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	envVar.ProjectID = projectID
	if err := services.CreateEnvVar(&envVar); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	// Mask secret on response
	if envVar.IsSecret {
		envVar.Value = "***"
	}
	c.JSON(http.StatusCreated, envVar)
}

// DeleteEnvVar handles DELETE /projects/:id/env/:envId
func DeleteEnvVar(c *gin.Context) {
	envID, err := uuid.Parse(c.Param("envId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid env var id"})
		return
	}
	if err := services.DeleteEnvVar(envID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusNoContent, nil)
}
