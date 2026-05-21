package services

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/abhishekkkk-15/infra-cd/api/internal/db"
	"github.com/abhishekkkk-15/infra-cd/api/internal/db/models"
	"github.com/google/uuid"
)

// CreateAgent registers a new agent and generates a unique token.
func CreateAgent(name string) (models.Agent, error) {
	token, err := generateToken()
	if err != nil {
		return models.Agent{}, fmt.Errorf("failed to generate token: %w", err)
	}
	agent := models.Agent{
		Name:   name,
		Token:  token,
		Status: models.AgentOffline,
	}
	err = db.DB.Create(&agent).Error
	return agent, err
}

func ListAgents() ([]models.Agent, error) {
	var agents []models.Agent
	err := db.DB.Find(&agents).Error
	return agents, err
}

func GetAgentByID(id uuid.UUID) (models.Agent, error) {
	var agent models.Agent
	err := db.DB.First(&agent, "id = ?", id).Error
	return agent, err
}

func GetAgentByToken(token string) (models.Agent, error) {
	var agent models.Agent
	err := db.DB.First(&agent, "token = ?", token).Error
	return agent, err
}

func DeleteAgent(id uuid.UUID) error {
	return db.DB.Delete(&models.Agent{}, "id = ?", id).Error
}

// RecordHeartbeat updates the agent's last_heartbeat and marks it online.
func RecordHeartbeat(id uuid.UUID) error {
	now := time.Now()
	return db.DB.Model(&models.Agent{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"last_heartbeat": now,
			"status":         models.AgentOnline,
		}).Error
}

// MarkStaleAgentsOffline sets agents offline if no heartbeat in 60s.
// Call this from a background goroutine in main.
func MarkStaleAgentsOffline() error {
	cutoff := time.Now().Add(-60 * time.Second)
	return db.DB.Model(&models.Agent{}).
		Where("last_heartbeat < ? AND status = ?", cutoff, models.AgentOnline).
		Update("status", models.AgentOffline).Error
}

func generateToken() (string, error) {
	bytes := make([]byte, 24)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return "icd_" + hex.EncodeToString(bytes), nil
}
