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

func (s DeploymentStatus) String() string { return string(s) }

type Deployment struct {
	ID            uuid.UUID        `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	ProjectID     uuid.UUID        `json:"project_id"`
	AgentID       *uuid.UUID       `json:"agent_id"`
	Status        DeploymentStatus `json:"status"`
	CommitSHA     string           `json:"commit_sha"`
	CommitMessage string           `json:"commit_message"`
	Branch             string           `json:"branch"`
	IsAutoRollback     bool             `json:"is_auto_rollback"`
	RollbackFromCommit string           `json:"rollback_from_commit"`
	StartedAt          *time.Time       `json:"started_at"`
	FinishedAt         *time.Time       `json:"finished_at"`
	BaseModel
	Project Project
	Agent   Agent
	Logs    []DeploymentLog
	Steps   []DeploymentStep
}
