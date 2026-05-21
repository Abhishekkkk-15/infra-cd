package models

import (
	"time"

	"github.com/google/uuid"
)

type AgentStatus string

const (
	AgentOnline  AgentStatus = "online"
	AgentOffline AgentStatus = "offline"
)

type Agent struct {
	ID            uuid.UUID   `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	Name          string      `json:"name"`
	Token         string      `gorm:"unique" json:"token"`
	Hostname      string      `json:"hostname"`
	IP            string      `json:"status"`
	Status        AgentStatus `json:"status"`
	LastHeartbeat *time.Time  `json:"last_hearbeat"`
	BaseModel
	Deployments []Deployment
}
