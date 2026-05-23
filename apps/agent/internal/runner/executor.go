package runner

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/abhishekkkk-15/infra-cd/agent/internal/client"
)

type ExecutionContext struct {
	Client    *client.Client
	DeployID  string
	BuildPath string
}

func executeStep(ctx *ExecutionContext, name, command string, order int, execFunc func() error) error {
	var step *client.DeploymentStep
	var err error
	if ctx.Client != nil {
		step, err = ctx.Client.CreateDeploymentStep(ctx.DeployID, name, command, "running", order)
		if err != nil {
			ctx.logError(fmt.Sprintf("Failed to create step '%s': %v", name, err))
		}
	} else {
		fmt.Printf("[STEP RUNNING] %s: %s\n", name, command)
	}

	err = execFunc()

	if ctx.Client != nil && step != nil {
		status := "success"
		output := "Completed successfully"
		if err != nil {
			status = "failed"
			output = err.Error()
		}
		if updateErr := ctx.Client.UpdateDeploymentStep(ctx.DeployID, step.ID, status, output); updateErr != nil {
			ctx.logError(fmt.Sprintf("Failed to update step '%s': %v", name, updateErr))
		}
	} else {
		if err != nil {
			fmt.Printf("[STEP FAILED] %s: %v\n", name, err)
		} else {
			fmt.Printf("[STEP SUCCESS] %s\n", name)
		}
	}

	return err
}

func RunDeployment(c *client.Client, d client.Deployment) error {
	ctx := &ExecutionContext{
		Client:    c,
		DeployID:  d.ID,
		BuildPath: d.Project.BuildPath,
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
	cloneCmdStr := fmt.Sprintf("git clone --branch %s %s .", d.Branch, d.Project.RepoURL)
	err = executeStep(ctx, "Git Clone", cloneCmdStr, 1, func() error {
		cloneCmd := exec.Command("git", "clone", "--branch", d.Branch, d.Project.RepoURL, ".")
		cloneCmd.Dir = workDir
		return ctx.streamCommand(cloneCmd, envList)
	})
	if err != nil {
		return err
	}

	// 3. Checkout specific commit if provided
	if d.CommitSHA != "" && d.CommitSHA != "HEAD" {
		ctx.logInfo(fmt.Sprintf("Checking out commit %s", d.CommitSHA))
		checkoutCmdStr := fmt.Sprintf("git checkout %s", d.CommitSHA)
		err = executeStep(ctx, "Git Checkout", checkoutCmdStr, 2, func() error {
			checkoutCmd := exec.Command("git", "checkout", d.CommitSHA)
			checkoutCmd.Dir = workDir
			return ctx.streamCommand(checkoutCmd, envList)
		})
		if err != nil {
			return err
		}
	}

	// 4. Restore Cache
	ctx.logInfo("Restoring cached dependencies (if any)...")
	_ = executeStep(ctx, "Restore Cache", "Extracting cached folders", 3, func() error {
		if err := extractCache(d.ProjectID, workDir); err != nil {
			return err
		}
		return nil
	})

	// 5. Execute pipeline or fallback deploy script
	var config *PipelineConfig

	if d.Project.PipelineConfig != "" {
		ctx.logInfo("Using database-stored pipeline configuration...")
		config, err = ParsePipelineConfigString(d.Project.PipelineConfig)
		if err != nil {
			return fmt.Errorf("invalid database pipeline config: %v", err)
		}
	} else {
		// Look inside the project's build path first if specified
		var configPath string
		if d.Project.BuildPath != "" {
			p := filepath.Join(workDir, d.Project.BuildPath, ".infra-cd.yaml")
			if _, err := os.Stat(p); err == nil {
				configPath = p
			} else {
				p = filepath.Join(workDir, d.Project.BuildPath, ".infra-cd.yml")
				if _, err := os.Stat(p); err == nil {
					configPath = p
				}
			}
		}

		// Fallback to repository root
		if configPath == "" {
			p := filepath.Join(workDir, ".infra-cd.yaml")
			if _, err := os.Stat(p); err == nil {
				configPath = p
			} else {
				p = filepath.Join(workDir, ".infra-cd.yml")
				if _, err := os.Stat(p); err == nil {
					configPath = p
				}
			}
		}

		if configPath != "" {
			ctx.logInfo(fmt.Sprintf("Found %s, parsing pipeline configuration...", filepath.Base(configPath)))
			config, err = ParsePipelineConfig(configPath)
			if err != nil {
				return fmt.Errorf("invalid pipeline config: %v", err)
			}

			// Read raw YAML file and report it to the central server so it is populated in the database.
			if yamlBytes, readErr := os.ReadFile(configPath); readErr == nil && ctx.Client != nil {
				if reportErr := ctx.Client.ReportPipelineConfig(ctx.DeployID, string(yamlBytes)); reportErr != nil {
					ctx.logInfo(fmt.Sprintf("Warning: failed to report pipeline configuration: %v", reportErr))
				}
			}
		}
	}

	if config != nil {
		if len(config.Jobs) == 0 {
			ctx.logInfo("No jobs defined in pipeline config.")
		}

		// Retrieve list of changed files for path filtering
		changedFiles, err := getChangedFiles(workDir, d.CommitSHA)
		if err != nil {
			ctx.logInfo(fmt.Sprintf("Warning: failed to determine changed files: %v. Running all jobs.", err))
		} else if len(changedFiles) > 0 {
			ctx.logInfo(fmt.Sprintf("Detected %d changed file(s) in this commit.", len(changedFiles)))
		}

		for idx, job := range config.Jobs {
			stepOrder := 4 + idx
			if !shouldRunJob(job, changedFiles) {
				ctx.logInfo(fmt.Sprintf("--- Skipping Job: %s (no matching paths changed) ---", job.Name))
				_ = executeStep(ctx, job.Name, job.Script, stepOrder, func() error {
					ctx.logInfo(fmt.Sprintf("Job '%s' skipped because no changed files matched path filters: %v", job.Name, job.Paths))
					return nil
				})
				continue
			}
			ctx.logInfo(fmt.Sprintf("--- Running Job: %s ---", job.Name))
			err = executeStep(ctx, job.Name, job.Script, stepOrder, func() error {
				return ctx.runScript(workDir, job, envList)
			})
			if err != nil {
				return fmt.Errorf("job '%s' failed: %v", job.Name, err)
			}
		}

		if len(config.Cache) > 0 {
			ctx.logInfo("Saving cache for specified directories...")
			_ = executeStep(ctx, "Save Cache", "Archiving cache folders", 4+len(config.Jobs), func() error {
				return saveCache(d.ProjectID, workDir, config.Cache)
			})
		}
	} else {
		// Fallback to legacy deploy script logic
		if d.Project.IsDockerized {
			ctx.logInfo("Detected dockerized project, running docker build/compose...")
			script := d.Project.DeployScript
			if script == "" {
				script = "docker-compose up -d --build"
			}
			err = executeStep(ctx, "Docker Deploy", script, 4, func() error {
				return ctx.runScript(workDir, Job{Script: script}, envList)
			})
			if err != nil {
				return fmt.Errorf("docker deploy failed: %v", err)
			}
		} else {
			ctx.logInfo("Running shell deploy script...")
			script := d.Project.DeployScript
			if script == "" {
				script = "./deploy.sh"
			}
			err = executeStep(ctx, "Shell Deploy", script, 4, func() error {
				return ctx.runScript(workDir, Job{Script: script}, envList)
			})
			if err != nil {
				return fmt.Errorf("shell deploy failed: %v", err)
			}
		}
	}

	ctx.logInfo("Deployment execution completed successfully.")
	return nil
}

func (ctx *ExecutionContext) runScript(workDir string, job Job, envList []string) error {
	if job.Image != "" {
		ctx.logInfo(fmt.Sprintf("Running job inside sandboxed container: %s", job.Image))

		// 1. Write the script content to .infra_cd_run.sh with Unix line endings
		scriptPath := filepath.Join(workDir, ".infra_cd_run.sh")
		scriptContent := strings.ReplaceAll(job.Script, "\r\n", "\n")
		if !strings.HasPrefix(scriptContent, "#!") {
			scriptContent = "#!/bin/sh\n" + scriptContent
		}
		if err := os.WriteFile(scriptPath, []byte(scriptContent), 0755); err != nil {
			return fmt.Errorf("failed to write sandbox runner script: %w", err)
		}
		defer os.Remove(scriptPath)

		// 2. Write environment variables to .infra_cd_env inside workspace
		envPath := filepath.Join(workDir, ".infra_cd_env")
		var envFileContent strings.Builder
		for _, envVar := range envList {
			envFileContent.WriteString(envVar)
			envFileContent.WriteString("\n")
		}
		if err := os.WriteFile(envPath, []byte(envFileContent.String()), 0600); err != nil {
			return fmt.Errorf("failed to write sandbox env file: %w", err)
		}
		defer os.Remove(envPath)

		// 3. Construct and run docker command
		cmd := exec.Command("docker", "run", "--rm",
			"--env-file", "/workspace/.infra_cd_env",
			"-v", workDir+":/workspace",
			"-w", filepath.ToSlash(filepath.Join("/workspace", ctx.BuildPath)),
			job.Image,
			"sh", "/workspace/.infra_cd_run.sh",
		)
		cmd.Dir = filepath.Join(workDir, ctx.BuildPath)
		return ctx.streamCommand(cmd, nil)
	}

	var cmd *exec.Cmd
	if runtime.GOOS == "windows" {
		scriptPath := filepath.Join(workDir, fmt.Sprintf("step_%d.ps1", time.Now().UnixNano()))
		psScript := "$ErrorActionPreference = 'Stop'\n" + job.Script
		if err := os.WriteFile(scriptPath, []byte(psScript), 0755); err != nil {
			return err
		}
		defer os.Remove(scriptPath)
		cmd = exec.Command("powershell", "-ExecutionPolicy", "Bypass", "-File", scriptPath)
	} else {
		cmd = exec.Command("sh", "-e", "-c", job.Script)
	}

	cmd.Dir = filepath.Join(workDir, ctx.BuildPath)

	if job.Background {
		return ctx.startBackgroundProcess(cmd, envList)
	}
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
			if ctx.Client != nil {
				ctx.Client.AppendLog(ctx.DeployID, text, "stdout")
			}
		}
	}()

	// Stream stderr
	go func() {
		defer wg.Done()
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			text := scanner.Text()
			fmt.Println("E>", text)
			if ctx.Client != nil {
				ctx.Client.AppendLog(ctx.DeployID, text, "stderr")
			}
		}
	}()

	wg.Wait()
	return cmd.Wait()
}

// startBackgroundProcess launches a process in the background without waiting for it to exit.
// It waits up to 2 seconds to confirm it didn't immediately crash, then detaches.
func (ctx *ExecutionContext) startBackgroundProcess(cmd *exec.Cmd, envList []string) error {
	cmd.Env = append(os.Environ(), envList...)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to create stdout pipe: %w", err)
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("failed to create stderr pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start background process: %w", err)
	}

	pid := cmd.Process.Pid
	ctx.logInfo(fmt.Sprintf("Background process started with PID %d — detaching.", pid))

	// Stream output in background goroutines — these will run until the process dies
	go func() {
		scanner := bufio.NewScanner(io.MultiReader(stdout, stderr))
		for scanner.Scan() {
			text := scanner.Text()
			fmt.Println(">", text)
			if ctx.Client != nil {
				ctx.Client.AppendLog(ctx.DeployID, text, "stdout")
			}
		}
	}()

	// Wait up to 2 seconds to detect an immediate crash
	doneCh := make(chan error, 1)
	go func() {
		doneCh <- cmd.Wait()
	}()

	select {
	case exitErr := <-doneCh:
		// Process exited within 2 seconds — it crashed on startup
		if exitErr != nil {
			return fmt.Errorf("background process exited immediately with error: %w", exitErr)
		}
		// Exited with code 0 within 2s (unusual but ok)
		ctx.logInfo(fmt.Sprintf("Background process (PID %d) exited cleanly.", pid))
		return nil
	case <-time.After(2 * time.Second):
		// Still running after 2s — successfully daemonized
		ctx.logInfo(fmt.Sprintf("Background process (PID %d) is running. Continuing pipeline.", pid))
		return nil
	}
}

func (ctx *ExecutionContext) logInfo(msg string) {
	fmt.Println("[INFO]", msg)
	// We use "stdout" as a generic message type for system events in logs
	if ctx.Client != nil {
		go ctx.Client.AppendLog(ctx.DeployID, msg, "stdout")
		time.Sleep(100 * time.Millisecond) // buffer ordering
	}
}

func (ctx *ExecutionContext) logError(msg string) {
	fmt.Println("[ERROR]", msg)
	if ctx.Client != nil {
		go ctx.Client.AppendLog(ctx.DeployID, msg, "stderr")
		time.Sleep(100 * time.Millisecond) // buffer ordering
	}
}

func getChangedFiles(workDir, commitSHA string) ([]string, error) {
	if commitSHA == "" || commitSHA == "HEAD" {
		cmd := exec.Command("git", "rev-parse", "HEAD")
		cmd.Dir = workDir
		out, err := cmd.Output()
		if err != nil {
			return nil, err
		}
		commitSHA = strings.TrimSpace(string(out))
	}

	cmd := exec.Command("git", "diff-tree", "--no-commit-id", "--name-only", "--root", "-r", "-m", commitSHA)
	cmd.Dir = workDir
	out, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("failed to get diff: %w", err)
	}

	var files []string
	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed != "" {
			files = append(files, trimmed)
		}
	}
	return files, nil
}

func shouldRunJob(job Job, changedFiles []string) bool {
	if len(job.Paths) == 0 {
		return true
	}
	if len(changedFiles) == 0 {
		return true
	}
	for _, pattern := range job.Paths {
		for _, file := range changedFiles {
			if matchPathPattern(pattern, file) {
				return true
			}
		}
	}
	return false
}

func matchPathPattern(pattern, path string) bool {
	pattern = filepath.ToSlash(filepath.Clean(pattern))
	path = filepath.ToSlash(filepath.Clean(path))

	if strings.Contains(pattern, "**") {
		parts := strings.Split(pattern, "**")
		prefix := parts[0]
		// If the prefix has a trailing slash, we might have cleaned it, but let's be careful.
		// e.g. "frontend/**" prefix is "frontend/".
		if strings.HasPrefix(path, prefix) {
			if len(parts) > 1 && parts[1] != "" {
				return strings.HasSuffix(path, parts[1])
			}
			return true
		}
		return false
	}

	matched, err := filepath.Match(pattern, path)
	if err == nil && matched {
		return true
	}

	if pattern == path || strings.HasPrefix(path, pattern+"/") {
		return true
	}

	return false
}
