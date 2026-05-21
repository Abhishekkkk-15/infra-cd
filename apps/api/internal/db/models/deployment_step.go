package models

import "github.com/google/uuid"

type StepStatus string

const (
	StepPending StepStatus = "pending"
	StepRunning StepStatus = "running"
	StepSuccess StepStatus = "success"
	StepFailed  StepStatus = "failed"
)

type DeploymentStep struct {
	ID           uuid.UUID  `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	DeploymentID uuid.UUID  `json:"deployment_id"`
	Name         string     `json:"name"`
	Command      string     `gorm:"type:text" json:"command"`
	Order        int        `json:"order"`
	Status       StepStatus `json:"status"`
	Output       string     `gorm:"type:text" json:"output"`
	BaseModel
	Deployment Deployment `json:"-"`
}
