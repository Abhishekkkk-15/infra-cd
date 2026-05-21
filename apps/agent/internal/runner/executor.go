package runner

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sync"
	"time"

	"github.com/abhishekkkk-15/infra-cd/agent/internal/client"
)

type ExecutionContext struct {
	Client   *client.Client
	DeployID string
}

func RunDeployment(c *client.Client, d client.Deployment) error {
	ctx := &ExecutionContext{
		Client:   c,
		DeployID: d.ID,
	}

	workDir := filepath.Join(os.TempDir(), "infracd-workspace", d.ID)
	if err := os.MkdirAll(workDir, 0755); err != nil {
		return fmt.Errorf("failed to create workdir: %v", err)
	}
	defer os.RemoveAll(workDir) // Cleanup after deployment

	// 1. Fetch Env Vars
	envVars, err := c.GetProjectEnvVars(d.ProjectID)
	if err != nil {
		ctx.logError(fmt.Sprintf("Failed to fetch env vars: %v", err))
		return err
	}

	// Prepare env array
	var envList []string
	for k, v := range envVars {
		envList = append(envList, fmt.Sprintf("%s=%s", k, v))
	}

	// 2. Clone Repository
	ctx.logInfo(fmt.Sprintf("Cloning repository %s (branch: %s)", d.Project.RepoURL, d.Branch))
	cloneCmd := exec.Command("git", "clone", "--branch", d.Branch, d.Project.RepoURL, ".")
	cloneCmd.Dir = workDir
	if err := ctx.streamCommand(cloneCmd, envList); err != nil {
		return fmt.Errorf("git clone failed: %v", err)
	}

	// 3. Checkout specific commit if provided
	if d.CommitSHA != "" && d.CommitSHA != "HEAD" {
		ctx.logInfo(fmt.Sprintf("Checking out commit %s", d.CommitSHA))
		checkoutCmd := exec.Command("git", "checkout", d.CommitSHA)
		checkoutCmd.Dir = workDir
		if err := ctx.streamCommand(checkoutCmd, envList); err != nil {
			return fmt.Errorf("git checkout failed: %v", err)
		}
	}

	// 4. Execute pipeline or fallback deploy script
	configPath := filepath.Join(workDir, ".infra-cd.yaml")
	if _, err := os.Stat(configPath); err == nil {
		ctx.logInfo("Found .infra-cd.yaml, parsing pipeline configuration...")
		config, err := ParsePipelineConfig(configPath)
		if err != nil {
			return fmt.Errorf("invalid pipeline config: %v", err)
		}

		if len(config.Jobs) == 0 {
			ctx.logInfo("No jobs defined in pipeline config.")
		}

		for _, job := range config.Jobs {
			ctx.logInfo(fmt.Sprintf("--- Running Job: %s ---", job.Name))
			if err := ctx.runScript(workDir, job.Script, envList); err != nil {
				return fmt.Errorf("job '%s' failed: %v", job.Name, err)
			}
		}
	} else {
		// Fallback to legacy deploy script logic
		if d.Project.IsDockerized {
			ctx.logInfo("Detected dockerized project, running docker build/compose...")
			script := d.Project.DeployScript
			if script == "" {
				script = "docker-compose up -d --build"
			}
			if err := ctx.runScript(workDir, script, envList); err != nil {
				return fmt.Errorf("docker deploy failed: %v", err)
			}
		} else {
			ctx.logInfo("Running shell deploy script...")
			script := d.Project.DeployScript
			if script == "" {
				script = "./deploy.sh"
			}
			if err := ctx.runScript(workDir, script, envList); err != nil {
				return fmt.Errorf("shell deploy failed: %v", err)
			}
		}
	}

	ctx.logInfo("Deployment execution completed successfully.")
	return nil
}

func (ctx *ExecutionContext) runScript(workDir, script string, envList []string) error {
	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		scriptPath := filepath.Join(workDir, fmt.Sprintf("step_%d.ps1", time.Now().UnixNano()))
		psScript := "$ErrorActionPreference = 'Stop'\n" + script
		if err := os.WriteFile(scriptPath, []byte(psScript), 0755); err != nil {
			return err
		}
		cmd = exec.Command("powershell", "-ExecutionPolicy", "Bypass", "-File", scriptPath)
	} else {
		cmd = exec.Command("sh", "-e", "-c", script)
	}

	cmd.Dir = workDir
	return ctx.streamCommand(cmd, envList)
}

func (ctx *ExecutionContext) streamCommand(cmd *exec.Cmd, envList []string) error {
	cmd.Env = append(os.Environ(), envList...)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return err
	}

	if err := cmd.Start(); err != nil {
		return err
	}

	var wg sync.WaitGroup
	wg.Add(2)

	// Stream stdout
	go func() {
		defer wg.Done()
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			text := scanner.Text()
			fmt.Println(">", text)
			ctx.Client.AppendLog(ctx.DeployID, text, "stdout")
		}
	}()

	// Stream stderr
	go func() {
		defer wg.Done()
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			text := scanner.Text()
			fmt.Println("E>", text)
			ctx.Client.AppendLog(ctx.DeployID, text, "stderr")
		}
	}()

	wg.Wait()
	return cmd.Wait()
}

func (ctx *ExecutionContext) logInfo(msg string) {
	fmt.Println("[INFO]", msg)
	// We use "stdout" as a generic message type for system events in logs
	go ctx.Client.AppendLog(ctx.DeployID, msg, "stdout")
	time.Sleep(100 * time.Millisecond) // buffer ordering
}

func (ctx *ExecutionContext) logError(msg string) {
	fmt.Println("[ERROR]", msg)
	go ctx.Client.AppendLog(ctx.DeployID, msg, "stderr")
	time.Sleep(100 * time.Millisecond) // buffer ordering
}
