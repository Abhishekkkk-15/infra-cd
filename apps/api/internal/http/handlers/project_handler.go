package handlers

import (
	"net/http"

	"github.com/abhishekkkk-15/infra-cd/api/internal/db/models"
	"github.com/abhishekkkk-15/infra-cd/api/internal/http/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// CreateProject handles POST /projects
func CreateProject(c *gin.Context) {
	var project models.Project
	if err := c.ShouldBindJSON(&project); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if project.Branch == "" {
		project.Branch = "main"
	}
	
	// Extract userID from context (set by auth middleware)
	if userID, exists := c.Get("userID"); exists {
		if idStr, ok := userID.(string); ok {
			if parsedID, err := uuid.Parse(idStr); err == nil {
				project.UserID = parsedID
			}
		}
	}

	if err := services.CreateProject(&project); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, project)
}

// GetProjects handles GET /projects
func GetProjects(c *gin.Context) {
	projects, err := services.GetProjects()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, projects)
}

// GetProjectByID handles GET /projects/:id
func GetProjectByID(c *gin.Context) {
	id := c.Param("id")
	project, err := services.GetProjectByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "project not found"})
		return
	}
	c.JSON(http.StatusOK, project)
}

// UpdateProject handles PUT /projects/:id
func UpdateProject(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id"})
		return
	}
	var updates models.Project
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	project, err := services.UpdateProject(id, &updates)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, project)
}

// DeleteProject handles DELETE /projects/:id
func DeleteProject(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id"})
		return
	}
	if err := services.DeleteProject(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusNoContent, nil)
}
