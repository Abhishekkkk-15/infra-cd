package handlers

import (
	"net/http"

	"github.com/abhishekkkk-15/infra-cd/api/internal/http/services"
	"github.com/gin-gonic/gin"
)

// GetSystemMetrics handles GET /system/metrics
func GetSystemMetrics(c *gin.Context) {
	metrics, err := services.GetSystemMetrics()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, metrics)
}

// GetSystemLogs handles GET /system/logs
func GetSystemLogs(c *gin.Context) {
	logs, err := services.GetSystemLogs()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, logs)
}
