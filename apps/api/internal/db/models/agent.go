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
	ID            uuid.UUID   `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Name          string      `json:"name"`
	Token         string      `gorm:"unique" json:"token"`
	Hostname      string      `json:"hostname"`
	IP            string      `json:"ip"`
	Status        AgentStatus `json:"status"`
	LastHeartbeat *time.Time  `json:"last_heartbeat"`
	CpuUsage      float64     `json:"cpuUsage"`
	RamUsage      float64     `json:"ramUsage"`
	BaseModel
	Deployments []Deployment `gorm:"constraint:OnDelete:SET NULL;" json:"-"`
}
