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

func CreateAgent(name string, userID uuid.UUID) (models.Agent, error) {
	token, err := generateToken()
	if err != nil {
		return models.Agent{}, fmt.Errorf("failed to generate token: %w", err)
	}
	agent := models.Agent{
		Name:   name,
		Token:  token,
		Status: models.AgentOffline,
		UserID: userID,
	}
	err = db.DB.Create(&agent).Error
	return agent, err
}

func ListAgents(userID uuid.UUID) ([]models.Agent, error) {
	var agents []models.Agent
	err := db.DB.Where("user_id = ?", userID).Find(&agents).Error
	return agents, err
}

func GetAgentByID(id uuid.UUID, userID uuid.UUID) (models.Agent, error) {
	var agent models.Agent
	err := db.DB.Where("id = ? AND user_id = ?", id, userID).First(&agent).Error
	return agent, err
}

func GetAgentByIDSystem(id uuid.UUID) (models.Agent, error) {
	var agent models.Agent
	err := db.DB.First(&agent, "id = ?", id).Error
	return agent, err
}

func VerifyAgent(token string) (models.Agent, error) {
	var agent models.Agent
	err := db.DB.First(&agent, "token = ?", token).Error
	return agent, err
}

func GetAgentByToken(token string) (models.Agent, error) {
	var agent models.Agent
	err := db.DB.First(&agent, "token = ?", token).Error
	return agent, err
}

func DeleteAgent(id uuid.UUID, userID uuid.UUID) error {
	var agent models.Agent
	if err := db.DB.Where("id = ? AND user_id = ?", id, userID).First(&agent).Error; err != nil {
		return err
	}

	if err := db.DB.Model(&models.Deployment{}).Where("agent_id = ?", id).Update("agent_id", nil).Error; err != nil {
		return fmt.Errorf("failed to unlink agent deployments: %w", err)
	}
	return db.DB.Delete(&models.Agent{}, "id = ?", id).Error
}

func RecordHeartbeat(id uuid.UUID, cpu, ram float64) error {
	now := time.Now()
	res := db.DB.Model(&models.Agent{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"last_heartbeat": now,
			"status":         models.AgentOnline,
			"cpu_usage":      cpu,
			"ram_usage":      ram,
		})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return fmt.Errorf("agent not found")
	}
	return nil
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
