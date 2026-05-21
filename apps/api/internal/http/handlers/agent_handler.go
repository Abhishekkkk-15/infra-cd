package handlers

import (
	"fmt"
	"net/http"

	"github.com/abhishekkkk-15/infra-cd/api/internal/http/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// CreateAgent handles POST /agents
func CreateAgent(c *gin.Context) {
	var input struct {
		Name string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	agent, err := services.CreateAgent(input.Name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, agent)
}

// VerifyAgent handles GET /agents/verify
func VerifyAgent(c *gin.Context) {
	token := c.GetHeader("Authorization")
	if token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing token"})
		return
	}
	// Strip "Bearer "
	if len(token) > 7 && token[:7] == "Bearer " {
		token = token[7:]
	}
	agent, err := services.VerifyAgent(token)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
		return
	}
	c.JSON(http.StatusOK, agent)
}

// ListAgents handles GET /agents
func ListAgents(c *gin.Context) {
	agents, err := services.ListAgents()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, agents)
}

// GetAgentByID handles GET /agents/:id
func GetAgentByID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid agent id"})
		return
	}
	agent, err := services.GetAgentByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "agent not found"})
		return
	}
	c.JSON(http.StatusOK, agent)
}

// DeleteAgent handles DELETE /agents/:id
func DeleteAgent(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid agent id"})
		return
	}
	if err := services.DeleteAgent(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusNoContent, nil)
}

// Heartbeat handles POST /agents/:id/heartbeat
// Called by the agent daemon every ~15 seconds to signal it is alive.
func Heartbeat(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid agent id"})
		return
	}

	var req struct {
		CpuUsage float64 `json:"cpuUsage"`
		RamUsage float64 `json:"ramUsage"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		fmt.Printf("[API Heartbeat] Failed to bind JSON: %v\n", err)
	}

	if err := services.RecordHeartbeat(id, req.CpuUsage, req.RamUsage); err != nil {
		if err.Error() == "agent not found" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "agent not found or deleted"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "ok"})
}
