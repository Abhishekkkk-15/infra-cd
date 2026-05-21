package client

import (
	"fmt"
	"time"

	"github.com/go-resty/resty/v2"
)

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
	IsDockerized bool   `json:"is_dockerized"`
	DeployScript string `json:"deploy_script"`
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
		SetBody(map[string]float64{
			"cpuUsage": cpuUsage,
			"ramUsage": ramUsage,
		}).
		Post(fmt.Sprintf("/agents/%s/heartbeat", agentID))
	if err != nil {
		return err
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

func (c *Client) UpdateDeploymentStep(deployID, stepName, status, output string) error {
	// The API uses stepId in the URL. For simplicity, we can modify the API or pass the step name in body.
	// Actually, the API `PATCH /deployments/:id/steps/:stepId` uses Step ID.
	// We might need to adjust the API or the agent to match.
	// Since agent creates steps on the fly, it's better if agent just appends logs.
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
