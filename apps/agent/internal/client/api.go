package client

import (
	"errors"
	"fmt"
	"time"

	"github.com/go-resty/resty/v2"
)

// ErrAgentDeregistered is returned when the server responds with 401 indicating
// this agent token is no longer valid (agent was deleted from the dashboard).
var ErrAgentDeregistered = errors.New("agent has been deregistered from the server")

type Client struct {
	BaseURL string
	Token   string
	resty   *resty.Client
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
	if resp.IsError() {
		return nil, fmt.Errorf("verify failed: %s", resp.String())
	}
	return &result, nil
}

func (c *Client) SendHeartbeat(agentID string, cpuUsage, ramUsage float64) error {
	resp, err := c.resty.R().
		SetHeader("Content-Type", "application/json").
		SetBody(map[string]float64{
			"cpuUsage": cpuUsage,
			"ramUsage": ramUsage,
		}).
		Post(fmt.Sprintf("/agents/%s/heartbeat", agentID))
	if err != nil {
		return err
	}
	if resp.StatusCode() == 401 {
		return ErrAgentDeregistered
	}
	if resp.IsError() {
		return fmt.Errorf("heartbeat failed: %s", resp.String())
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
	resp, err := c.resty.R().
		SetBody(map[string]string{"status": status}).
		Patch(fmt.Sprintf("/deployments/%s/status", deployID))
	if err != nil {
		return err
	}
	if resp.IsError() {
		return fmt.Errorf("update status failed: %s", resp.String())
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
	var step DeploymentStep
	resp, err := c.resty.R().
		SetBody(map[string]interface{}{
			"name":    name,
			"command": command,
			"status":  status,
			"order":   order,
		}).
		SetResult(&step).
		Post(fmt.Sprintf("/deployments/%s/steps", deployID))
	if err != nil {
		return nil, err
	}
	if resp.IsError() {
		return nil, fmt.Errorf("create step failed: %s", resp.String())
	}
	return &step, nil
}

func (c *Client) UpdateDeploymentStep(deployID, stepID, status, output string) error {
	resp, err := c.resty.R().
		SetBody(map[string]string{
			"status": status,
			"output": output,
		}).
		Patch(fmt.Sprintf("/deployments/%s/steps/%s", deployID, stepID))
	if err != nil {
		return err
	}
	if resp.IsError() {
		return fmt.Errorf("update step failed: %s", resp.String())
	}
	return nil
}

func (c *Client) AppendLog(deployID, message, logType string) error {
	resp, err := c.resty.R().
		SetBody(map[string]string{"message": message, "type": logType}).
		Post(fmt.Sprintf("/deployments/%s/logs", deployID))
	if err != nil {
		return err
	}
	if resp.IsError() {
		return fmt.Errorf("append log failed: %s", resp.String())
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
	resp, err := c.resty.R().
		SetBody(map[string]string{"pipeline_config": config}).
		Post(fmt.Sprintf("/deployments/%s/pipeline-config", deployID))
	if err != nil {
		return err
	}
	if resp.IsError() {
		return fmt.Errorf("reporting pipeline config failed: %s", resp.String())
	}
	return nil
}
