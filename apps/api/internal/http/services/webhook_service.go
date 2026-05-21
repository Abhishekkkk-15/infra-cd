package services

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"

	"github.com/abhishekkkk-15/infra-cd/api/internal/db"
	"github.com/abhishekkkk-15/infra-cd/api/internal/db/models"
	"github.com/google/uuid"
)

func ListWebhooks(projectID uuid.UUID) ([]models.Webhook, error) {
	var webhooks []models.Webhook
	err := db.DB.Where("project_id = ?", projectID).Find(&webhooks).Error
	return webhooks, err
}

func CreateWebhook(projectID uuid.UUID, provider string) (models.Webhook, error) {
	secret, err := generateWebhookSecret()
	if err != nil {
		return models.Webhook{}, fmt.Errorf("failed to generate secret: %w", err)
	}
	wh := models.Webhook{
		ProjectID: projectID,
		Provider:  provider,
		Secret:    secret,
		IsActive:  true,
	}
	err = db.DB.Create(&wh).Error
	return wh, err
}

func DeleteWebhook(id uuid.UUID) error {
	return db.DB.Delete(&models.Webhook{}, "id = ?", id).Error
}

func generateWebhookSecret() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
