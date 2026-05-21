package models

import "github.com/google/uuid"

type Webhook struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	ProjectID uuid.UUID `json:"project_id"`
	Provider  string    `json:"provider"`
	Secret    string    `json:"secret"`
	IsActive  bool      `json:"is_active"`
	BaseModel
	Project Project
}
