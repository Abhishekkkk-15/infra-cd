package services

import (
	"github.com/abhishekkkk-15/infra-cd/api/internal/db"
	"github.com/abhishekkkk-15/infra-cd/api/internal/db/models"
	"github.com/google/uuid"
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
	return db.DB.Delete(&models.Project{}, "id = ?", id).Error
}
