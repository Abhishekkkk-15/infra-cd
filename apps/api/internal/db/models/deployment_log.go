package models

import "github.com/google/uuid"

type LogType string

const (
	LogStdout LogType = "stdout"
	LogStderr LogType = "stderr"
)

type DeploymentLog struct {
	ID           uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	DeploymentID uuid.UUID `json:"deployment_id"`
	Message      string    `gorm:"type:text" json:"message"`
	Type         LogType   `json:"type"`
	BaseModel
	Deployment Deployment
}
