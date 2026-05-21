package services

import (
	"github.com/abhishekkkk-15/infra-cd/api/internal/db"
	"github.com/abhishekkkk-15/infra-cd/api/internal/db/models"
	"github.com/google/uuid"
)

func ListEnvVars(projectID uuid.UUID) ([]models.EnvironmentVariable, error) {
	var envVars []models.EnvironmentVariable
	err := db.DB.Where("project_id = ?", projectID).Find(&envVars).Error
	// Mask secrets
	for i := range envVars {
		if envVars[i].IsSecret {
			envVars[i].Value = "***"
		}
	}
	return envVars, err
}

func CreateEnvVar(envVar *models.EnvironmentVariable) error {
	return db.DB.Create(envVar).Error
}

func DeleteEnvVar(id uuid.UUID) error {
	return db.DB.Delete(&models.EnvironmentVariable{}, "id = ?", id).Error
}
