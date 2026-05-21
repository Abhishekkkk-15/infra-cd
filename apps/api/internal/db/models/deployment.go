package models

import (
	"time"

	"github.com/google/uuid"
)

type DeploymentStatus string

const (
	DeploymentPending DeploymentStatus = "pending"
	DeploymentRunning DeploymentStatus = "running"
	DeploymentSuccess DeploymentStatus = "success"
	DeploymentFailed  DeploymentStatus = "failed"
)

type Deployment struct {
	ID            uuid.UUID        `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	ProjectID     uuid.UUID        `json:"project_id"`
	AgentID       *uuid.UUID       `json:"agent_id"`
	Status        DeploymentStatus `json:"status"`
	CommitSHA     string           `json:"commit_sha"`
	CommitMessage string           `json:"commit_message"`
	Branch        string           `json:"branch"`
	StartedAt     *time.Time       `json:"started_at"`
	FinishedAt    *time.Time       `json:"finished_at"`
	Project       Project
	Agent         Agent
	logs          []DeploymentLog
	Steps         []DeploymentStep
}
