package models

import (
	"crypto/rand"
	"encoding/hex"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

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
	PipelineConfig       string                 `gorm:"type:text" json:"pipeline_config"`
	UserID               uuid.UUID              `json:"user_id"`
	AgentID              *uuid.UUID             `json:"agent_id"`
	DeployToken          string                 `gorm:"unique" json:"deploy_token"`
	BaseModel
	Deployment           []Deployment           `gorm:"constraint:OnDelete:CASCADE;" json:"-"`
	EnvironmentVariables []EnvironmentVariable  `gorm:"constraint:OnDelete:CASCADE;" json:"-"`
	Webhooks             []Webhook              `gorm:"constraint:OnDelete:CASCADE;" json:"-"`
}

func (p *Project) BeforeCreate(tx *gorm.DB) (err error) {
	if p.DeployToken == "" {
		bytes := make([]byte, 24)
		if _, err := rand.Read(bytes); err != nil {
			return err
		}
		p.DeployToken = "icd_proj_" + hex.EncodeToString(bytes)
	}
	return nil
}
