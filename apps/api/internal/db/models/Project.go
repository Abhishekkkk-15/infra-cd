package models

import "github.com/google/uuid"

type Project struct {
	ID                   uuid.UUID              `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name                 string                 `json:"name"`
	Description          string                 `json:"description"`
	RepoURL              string                 `json:"repo_url"`
	Branch               string                 `json:"branch"`
	BuildPath            string                 `json:"build_path"`
	IsDockerized         bool                   `json:"is_dockerized"`
	DockerfilePath       string                 `json:"dockerfile_path"`
	DeployScript         string                 `gorm:"type:text" json:"deploy_script"`
	UserID               uuid.UUID              `json:"user_id"`
	BaseModel
	Deployment           []Deployment           `gorm:"constraint:OnDelete:CASCADE;" json:"-"`
	EnvironmentVariables []EnvironmentVariable  `gorm:"constraint:OnDelete:CASCADE;" json:"-"`
	Webhooks             []Webhook              `gorm:"constraint:OnDelete:CASCADE;" json:"-"`
}
