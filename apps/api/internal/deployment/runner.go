package deployment

import (
	"bufio"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/abhishekkkk-15/infra-cd/api/internal/db"
	"github.com/abhishekkkk-15/infra-cd/api/internal/db/models"
	"github.com/google/uuid"
)

// Run executes a deployment pipeline in a goroutine.
// It updates deployment status, creates steps, and streams logs to DB.
func Run(deploymentID uuid.UUID) {
	logger := slog.With("deployment_id", deploymentID)
	logger.Info("starting deployment runner")

	// Load deployment + project
	var d models.Deployment
	if err := db.DB.Preload("Project").First(&d, "id = ?", deploymentID).Error; err != nil {
		logger.Error("failed to load deployment", "error", err)
		return
	}

	// Load env vars for the project
	var envVars []models.EnvironmentVariable
	db.DB.Where("project_id = ?", d.ProjectID).Find(&envVars)

	// Mark running
	now := time.Now()
	db.DB.Model(&d).Updates(map[string]interface{}{
		"status":     models.DeploymentRunning,
		"started_at": now,
	})

	workDir, err := os.MkdirTemp("", fmt.Sprintf("infra-cd-%s-", deploymentID))
	if err != nil {
		failDeployment(d.ID, "failed to create workspace: "+err.Error())
		return
	}
	defer os.RemoveAll(workDir)

	// Build OS env slice
	osEnv := os.Environ()
	for _, ev := range envVars {
		osEnv = append(osEnv, ev.Key+"="+ev.Value)
	}

	// --- Step 1: Git Clone ---
	cloneCmd := fmt.Sprintf("git clone --depth=1 --branch %s %s .", d.Project.Branch, d.Project.RepoURL)
	if err := runStep(d.ID, "Git Clone", cloneCmd, workDir, osEnv, 1); err != nil {
		failDeployment(d.ID, "git clone failed")
		return
	}

	// --- Step 2: Build / Deploy ---
	if d.Project.IsDockerized {
		dockerfilePath := d.Project.DockerfilePath
		if dockerfilePath == "" {
			dockerfilePath = "Dockerfile"
		}
		imageName := fmt.Sprintf("infra-cd-%s", strings.ToLower(d.Project.Name))

		buildCmd := fmt.Sprintf("docker build -f %s -t %s .", filepath.Join(workDir, dockerfilePath), imageName)
		if err := runStep(d.ID, "Docker Build", buildCmd, workDir, osEnv, 2); err != nil {
			failDeployment(d.ID, "docker build failed")
			return
		}

		runCmd := fmt.Sprintf("docker run -d --name %s-%s %s", imageName, deploymentID.String()[:8], imageName)
		if err := runStep(d.ID, "Docker Run", runCmd, workDir, osEnv, 3); err != nil {
			failDeployment(d.ID, "docker run failed")
			return
		}
	} else {
		// Shell script deployment
		script := d.Project.DeployScript
		if script == "" {
			script = "echo 'No deploy script configured'"
		}
		if err := runStep(d.ID, "Deploy Script", script, workDir, osEnv, 2); err != nil {
			failDeployment(d.ID, "deploy script failed")
			return
		}
	}

	// Mark success
	finishedAt := time.Now()
	db.DB.Model(&d).Updates(map[string]interface{}{
		"status":      models.DeploymentSuccess,
		"finished_at": finishedAt,
	})
	logger.Info("deployment completed successfully")
}

// runStep creates a DeploymentStep record, executes the shell command,
// streams its output to DeploymentLog records, and updates step status.
func runStep(deploymentID uuid.UUID, name, command, workDir string, env []string, order int) error {
	step := models.DeploymentStep{
		DeploymentID: deploymentID,
		Name:         name,
		Command:      command,
		Order:        order,
		Status:       models.StepRunning,
	}
	db.DB.Create(&step)

	appendLog(deploymentID, fmt.Sprintf(">>> %s: %s", name, command), "stdout")

	cmd := exec.Command("sh", "-c", command)
	cmd.Dir = workDir
	cmd.Env = env

	stdout, _ := cmd.StdoutPipe()
	stderr, _ := cmd.StderrPipe()

	if err := cmd.Start(); err != nil {
		db.DB.Model(&step).Updates(map[string]interface{}{
			"status": models.StepFailed,
			"output": err.Error(),
		})
		return err
	}

	var outputLines []string

	// Stream stdout
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := scanner.Text()
			outputLines = append(outputLines, line)
			appendLog(deploymentID, line, "stdout")
		}
	}()

	// Stream stderr
	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			line := scanner.Text()
			outputLines = append(outputLines, "[stderr] "+line)
			appendLog(deploymentID, line, "stderr")
		}
	}()

	err := cmd.Wait()
	fullOutput := strings.Join(outputLines, "\n")

	if err != nil {
		db.DB.Model(&step).Updates(map[string]interface{}{
			"status": models.StepFailed,
			"output": fullOutput,
		})
		return err
	}

	db.DB.Model(&step).Updates(map[string]interface{}{
		"status": models.StepSuccess,
		"output": fullOutput,
	})
	return nil
}

func appendLog(deploymentID uuid.UUID, message, logType string) {
	db.DB.Create(&models.DeploymentLog{
		DeploymentID: deploymentID,
		Message:      message,
		Type:         models.LogType(logType),
	})
}

func failDeployment(deploymentID uuid.UUID, reason string) {
	slog.Error("deployment failed", "id", deploymentID, "reason", reason)
	finishedAt := time.Now()
	db.DB.Model(&models.Deployment{}).
		Where("id = ?", deploymentID).
		Updates(map[string]interface{}{
			"status":      models.DeploymentFailed,
			"finished_at": finishedAt,
		})
	appendLog(deploymentID, "DEPLOYMENT FAILED: "+reason, "stderr")
}
