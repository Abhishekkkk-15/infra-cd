package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/abhishekkkk-15/infra-cd/api/internal/db"
	"github.com/abhishekkkk-15/infra-cd/api/internal/db/models"
	"github.com/abhishekkkk-15/infra-cd/api/internal/http/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ListWebhooks handles GET /projects/:id/webhooks
func ListWebhooks(c *gin.Context) {
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id"})
		return
	}
	webhooks, err := services.ListWebhooks(projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, webhooks)
}

// CreateWebhook handles POST /projects/:id/webhooks
func CreateWebhook(c *gin.Context) {
	projectID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project id"})
		return
	}

	var body struct {
		Provider string `json:"provider" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	wh, err := services.CreateWebhook(projectID, body.Provider)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, wh)
}

// DeleteWebhook handles DELETE /projects/:id/webhooks/:webhookId
func DeleteWebhook(c *gin.Context) {
	whID, err := uuid.Parse(c.Param("webhookId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid webhook id"})
		return
	}

	if err := services.DeleteWebhook(whID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

// GithubWebhook handles POST /webhooks/github — receives GitHub push events
func GithubWebhook(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read body"})
		return
	}

	// Parse payload including commits info
	var payload struct {
		Ref        string `json:"ref"`
		Repository struct {
			CloneURL string `json:"clone_url"`
		} `json:"repository"`
		Commits []struct {
			Added    []string `json:"added"`
			Removed  []string `json:"removed"`
			Modified []string `json:"modified"`
		} `json:"commits"`
		HeadCommit struct {
			ID      string `json:"id"`
			Message string `json:"message"`
		} `json:"head_commit"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	// Derive branch from ref (refs/heads/main → main)
	branch := strings.TrimPrefix(payload.Ref, "refs/heads/")
	repoURL := payload.Repository.CloneURL

	// Collect changed files in this push
	var changedFiles []string
	for _, commit := range payload.Commits {
		changedFiles = append(changedFiles, commit.Added...)
		changedFiles = append(changedFiles, commit.Removed...)
		changedFiles = append(changedFiles, commit.Modified...)
	}

	// Find all matching active webhooks (loop over all projects registered for this repo/branch)
	var webhooks []models.Webhook
	err = db.DB.
		Preload("Project").
		Joins("JOIN projects ON projects.id = webhooks.project_id").
		Where("projects.repo_url = ? AND projects.branch = ? AND webhooks.provider = ? AND webhooks.is_active = true",
			repoURL, branch, "github").
		Find(&webhooks).Error
	if err != nil || len(webhooks) == 0 {
		c.JSON(http.StatusOK, gin.H{"status": "no matching active projects/webhooks found"})
		return
	}

	sig := c.GetHeader("X-Hub-Signature-256")
	triggeredCount := 0
	var lastErr error

	for _, wh := range webhooks {
		// Verify signature for each webhook
		if !verifyGithubSignature(wh.Secret, body, sig) {
			continue // Signature doesn't match this webhook, skip
		}

		// Perform path filter matching if BuildPath is specified and we have changed files
		shouldTrigger := true
		if wh.Project.BuildPath != "" && len(changedFiles) > 0 {
			shouldTrigger = false
			for _, file := range changedFiles {
				if matchesPath(file, wh.Project.BuildPath) {
					shouldTrigger = true
					break
				}
			}
		}

		if shouldTrigger {
			if _, err := services.TriggerDeploymentWithCommit(wh.ProjectID, payload.HeadCommit.ID, payload.HeadCommit.Message, "", false); err != nil {
				lastErr = err
			} else {
				triggeredCount++
			}
		}
	}

	if lastErr != nil && triggeredCount == 0 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": lastErr.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":            "processed",
		"triggered_count":   triggeredCount,
		"matching_projects": len(webhooks),
	})
}

func matchesPath(filePath, filterPath string) bool {
	if filterPath == "" {
		return true
	}
	filePath = filepath.ToSlash(filepath.Clean(filePath))
	filterPath = filepath.ToSlash(filepath.Clean(filterPath))

	if filePath == filterPath {
		return true
	}
	if strings.HasPrefix(filePath, filterPath+"/") {
		return true
	}
	return false
}

func verifyGithubSignature(secret string, body []byte, signature string) bool {
	if !strings.HasPrefix(signature, "sha256=") {
		return false
	}
	sig := strings.TrimPrefix(signature, "sha256=")
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(sig))
}
