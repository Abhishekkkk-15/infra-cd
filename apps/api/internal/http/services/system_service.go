package services

import (
	"time"

	"github.com/abhishekkkk-15/infra-cd/api/internal/db"
	"github.com/abhishekkkk-15/infra-cd/api/internal/db/models"
)

type SystemMetrics struct {
	RunningBuilds int `json:"runningBuilds"`
	QueuedBuilds  int `json:"queuedBuilds"`
	ActiveAgents  int `json:"activeAgents"`
	TotalProjects int `json:"totalProjects"`
	CpuUsage      int `json:"cpuUsage"`
	RamUsage      int `json:"ramUsage"`
	History       []MetricHistory `json:"history"`
}

type MetricHistory struct {
	Timestamp string `json:"timestamp"`
	Cpu       int    `json:"cpu"`
	Ram       int    `json:"ram"`
}

type ActivityLog struct {
	ID        string `json:"id"`
	Type      string `json:"type"`
	Message   string `json:"message"`
	Severity  string `json:"severity"`
	Timestamp string `json:"timestamp"`
}

func GetSystemMetrics() (SystemMetrics, error) {
	var metrics SystemMetrics

	// Projects
	var projects int64
	db.DB.Model(&models.Project{}).Count(&projects)
	metrics.TotalProjects = int(projects)

	// Agents
	var activeAgents int64
	db.DB.Model(&models.Agent{}).Where("status = ?", "online").Count(&activeAgents)
	metrics.ActiveAgents = int(activeAgents)

	// Deployments
	var running int64
	var pending int64
	db.DB.Model(&models.Deployment{}).Where("status = ?", models.DeploymentRunning).Count(&running)
	db.DB.Model(&models.Deployment{}).Where("status = ?", models.DeploymentPending).Count(&pending)
	metrics.RunningBuilds = int(running)
	metrics.QueuedBuilds = int(pending)

	// Mock CPU and RAM for now (or average from online agents)
	var agents []models.Agent
	if err := db.DB.Where("status = ?", "online").Find(&agents).Error; err == nil && len(agents) > 0 {
		var totalCpu int
		var totalRam int
		for range agents {
			totalCpu += 45 // Dummy value since we don't track live CPU in DB yet
			totalRam += 60
		}
		metrics.CpuUsage = totalCpu / len(agents)
		metrics.RamUsage = totalRam / len(agents)
	} else {
		metrics.CpuUsage = 0
		metrics.RamUsage = 0
	}

	// Mock History
	now := time.Now()
	metrics.History = []MetricHistory{
		{Timestamp: now.Add(-4 * time.Minute).Format("15:04:05"), Cpu: 30, Ram: 40},
		{Timestamp: now.Add(-3 * time.Minute).Format("15:04:05"), Cpu: 45, Ram: 45},
		{Timestamp: now.Add(-2 * time.Minute).Format("15:04:05"), Cpu: 60, Ram: 50},
		{Timestamp: now.Add(-1 * time.Minute).Format("15:04:05"), Cpu: 50, Ram: 55},
		{Timestamp: now.Format("15:04:05"), Cpu: metrics.CpuUsage, Ram: metrics.RamUsage},
	}

	return metrics, nil
}

func GetSystemLogs() ([]ActivityLog, error) {
	// Let's return recent deployments as activity logs
	var deployments []models.Deployment
	db.DB.Preload("Project").Order("created_at desc").Limit(10).Find(&deployments)

	var logs []ActivityLog
	for _, d := range deployments {
		severity := "info"
		if d.Status == models.DeploymentSuccess {
			severity = "success"
		} else if d.Status == models.DeploymentFailed {
			severity = "error"
		} else if d.Status == models.DeploymentRunning {
			severity = "warning"
		}

		logs = append(logs, ActivityLog{
			ID:        d.ID.String(),
			Type:      "deployment",
			Message:   "Deployment " + d.Project.Name + " (" + d.CommitSHA[:7] + ") - " + string(d.Status),
			Severity:  severity,
			Timestamp: d.CreatedAt.Format(time.RFC3339),
		})
	}
	return logs, nil
}
