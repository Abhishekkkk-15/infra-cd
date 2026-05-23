package client

import (
	"errors"
	"fmt"
	"time"

	"github.com/go-resty/resty/v2"
	"github.com/google/uuid"
)

// ErrAgentDeregistered is returned when the server responds with 401 indicating
// this agent token is no longer valid (agent was deleted from the dashboard).
var ErrAgentDeregistered = errors.New("agent has been deregistered from the server")

// ErrInvalidToken is returned during startup verification when the token is
// rejected by the server (401/403). The agent should stop, not restart.
var ErrInvalidToken = errors.New("agent token is invalid or revoked")

type Client struct {
	BaseURL string
	Token   string
	resty   *resty.Client
	WS      *WSClient
}

func NewClient(baseURL, token string) *Client {
	c := resty.New().
		SetBaseURL(baseURL + "/api/v1").
		SetHeader("Authorization", "Bearer "+token).
		SetTimeout(10 * time.Second)
	return &Client{
		BaseURL: baseURL,
		Token:   token,
		resty:   c,
		// WS will be initialized by main.go and attached here
	}
}

// Structs matching the API shapes
type Agent struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type Project struct {
	ID           string `json:"id"`
	RepoURL      string `json:"repo_url"`
	Branch       string `json:"branch"`
	BuildPath    string `json:"build_path"`
	IsDockerized   bool   `json:"is_dockerized"`
	DeployScript   string `json:"deploy_script"`
	PipelineConfig string `json:"pipeline_config"`
}

type Deployment struct {
	ID        string  `json:"id"`
	ProjectID string  `json:"project_id"`
	CommitSHA string  `json:"commit_sha"`
	Branch    string  `json:"branch"`
	Project   Project `json:"project"` // The API needs to preload Project in PendingDeployments for us to access this!
}

func (c *Client) VerifyAgent() (*Agent, error) {
	var result Agent
	resp, err := c.resty.R().SetResult(&result).Get("/agents/verify")
	if err != nil {
		return nil, err
	}
	if resp.StatusCode() == 401 || resp.StatusCode() == 403 {
		return nil, ErrInvalidToken
	}
	if resp.IsError() {
		return nil, fmt.Errorf("verify failed: %s", resp.String())
	}
	return &result, nil
}

func (c *Client) SendHeartbeat(agentID string, cpuUsage, ramUsage float64) error {
	if c.WS != nil {
		c.WS.Push(WSMessage{
			Type: "heartbeat",
			Payload: map[string]float64{
				"cpuUsage": cpuUsage,
				"ramUsage": ramUsage,
			},
		})
	}
	return nil
}

func (c *Client) GetPendingDeployments(agentID string) ([]Deployment, error) {
	var result []Deployment
	resp, err := c.resty.R().SetResult(&result).Get(fmt.Sprintf("/agents/%s/pending-deployments", agentID))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode() == 401 {
		return nil, ErrAgentDeregistered
	}
	if resp.IsError() {
		return nil, fmt.Errorf("get pending failed: %s", resp.String())
	}
	return result, nil
}

func (c *Client) UpdateDeploymentStatus(deployID, status string) error {
	if c.WS != nil {
		c.WS.Push(WSMessage{
			Type: "status_update",
			Payload: map[string]string{
				"deployment_id": deployID,
				"status":        status,
			},
		})
	}
	return nil
}

type DeploymentStep struct {
	ID           string `json:"id"`
	DeploymentID string `json:"deployment_id"`
	Name         string `json:"name"`
	Command      string `json:"command"`
	Order        int    `json:"order"`
	Status       string `json:"status"`
	Output       string `json:"output"`
}

func (c *Client) CreateDeploymentStep(deployID, name, command, status string, order int) (*DeploymentStep, error) {
	stepID := uuid.New().String()
	
	step := &DeploymentStep{
		ID:           stepID,
		DeploymentID: deployID,
		Name:         name,
		Command:      command,
		Status:       status,
		Order:        order,
	}

	if c.WS != nil {
		c.WS.Push(WSMessage{
			Type: "step_create",
			Payload: step,
		})
	}
	return step, nil
}

func (c *Client) UpdateDeploymentStep(deployID, stepID, status, output string) error {
	if c.WS != nil {
		c.WS.Push(WSMessage{
			Type: "step_update",
			Payload: map[string]string{
				"step_id": stepID,
				"status":  status,
				"output":  output,
			},
		})
	}
	return nil
}

func (c *Client) AppendLog(deployID, message, logType string) error {
	if c.WS != nil {
		c.WS.Push(WSMessage{
			Type: "log_append",
			Payload: map[string]string{
				"deployment_id": deployID,
				"message":       message,
				"type":          logType,
			},
		})
	}
	return nil
}

func (c *Client) GetProjectEnvVars(projectID string) (map[string]string, error) {
	var result []struct {
		Key   string `json:"key"`
		Value string `json:"value"`
	}
	resp, err := c.resty.R().SetResult(&result).Get(fmt.Sprintf("/agents/projects/%s/env", projectID))
	if err != nil {
		return nil, err
	}
	if resp.IsError() {
		return nil, fmt.Errorf("get env failed: %s", resp.String())
	}

	envMap := make(map[string]string)
	for _, v := range result {
		envMap[v.Key] = v.Value
	}
	return envMap, nil
}

func (c *Client) ReportPipelineConfig(deployID, config string) error {
	if c.WS != nil {
		c.WS.Push(WSMessage{
			Type: "pipeline_config_report",
			Payload: map[string]string{
				"deployment_id":   deployID,
				"pipeline_config": config,
			},
		})
	}
	return nil
}
