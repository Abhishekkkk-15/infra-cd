package services

import (
	"github.com/abhishekkkk-15/infra-cd/api/internal/db"
	"github.com/abhishekkkk-15/infra-cd/api/internal/db/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func CreateProject(project *models.Project) error {
	return db.DB.Create(project).Error
}

func GetProjects() ([]models.Project, error) {
	var projects []models.Project
	err := db.DB.Find(&projects).Error
	return projects, err
}

func GetProjectByID(id string) (models.Project, error) {
	var project models.Project
	err := db.DB.First(&project, "id = ?", id).Error
	return project, err
}

func UpdateProject(id uuid.UUID, updates *models.Project) (models.Project, error) {
	var project models.Project
	if err := db.DB.First(&project, "id = ?", id).Error; err != nil {
		return project, err
	}
	if err := db.DB.Model(&project).Updates(updates).Error; err != nil {
		return project, err
	}
	return project, nil
}

func DeleteProject(id uuid.UUID) error {
	return db.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("project_id = ?", id).Delete(&models.EnvironmentVariable{}).Error; err != nil {
			return err
		}
		if err := tx.Where("project_id = ?", id).Delete(&models.Webhook{}).Error; err != nil {
			return err
		}

		var deployments []models.Deployment
		if err := tx.Where("project_id = ?", id).Find(&deployments).Error; err != nil {
			return err
		}

		for _, d := range deployments {
			if err := tx.Where("deployment_id = ?", d.ID).Delete(&models.DeploymentLog{}).Error; err != nil {
				return err
			}
			if err := tx.Where("deployment_id = ?", d.ID).Delete(&models.DeploymentStep{}).Error; err != nil {
				return err
			}
			if err := tx.Delete(&d).Error; err != nil {
				return err
			}
		}

		return tx.Delete(&models.Project{}, "id = ?", id).Error
	})
}
