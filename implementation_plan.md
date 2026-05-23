# Implementation Plan - Docker Container Sandboxing (Option A) 🐳

We will update the agent runner to execute pipeline jobs inside sandboxed Docker containers when a job specifies a container `image` in `.infra-cd.yaml`.

---

## User Review Required

> [!IMPORTANT]
> This feature introduces a dependency on the Docker daemon on the Agent host machine. If `image` is specified for a job, the Agent host must have Docker installed and running, and the Agent process must have permission to execute `docker` commands.

---

## Proposed Changes

### Agent Runner Component

#### [MODIFY] [parser.go](file:///d:/go/infra-cd/apps/agent/internal/runner/parser.go)
* Add `Image` string field to the `Job` struct.
* Map it to the `image` YAML tag.
```go
type Job struct {
	Name   string   `yaml:"name"`
	Script string   `yaml:"script"`
	Paths  []string `yaml:"paths"`
	Image  string   `yaml:"image"` // Container image name (e.g. node:18-alpine, ubuntu:latest)
}
```

#### [MODIFY] [executor.go](file:///d:/go/infra-cd/apps/agent/internal/runner/executor.go)
* Modify the `runScript` method signature to accept a `Job` instead of just a raw script string:
  ```diff
  -func (ctx *ExecutionContext) runScript(workDir, script string, envList []string) error
  +func (ctx *ExecutionContext) runScript(workDir string, job Job, envList []string) error
  ```
* Update `RunDeployment` where `runScript` is called to pass the `job` struct:
  ```diff
  -return ctx.runScript(workDir, job.Script, envList)
  +return ctx.runScript(workDir, job, envList)
  ```
* Inside `runScript`, check if `job.Image` is specified:
  * **If empty**: Fall back to current behavior (running directly on the host shell/PowerShell).
  * **If specified**: Run the script inside a Docker container:
    1. Write the script content to a temporary shell script file, e.g. `.infra_cd_run.sh` inside the workspace `workDir`. Ensure lines end with Unix `\n` line endings so they run cleanly in Linux containers.
    2. Write the environment variables (`envList`) to a temp file `.infra_cd_env` inside `workDir` formatted as `KEY=VALUE` pairs.
    3. Construct and run the `docker run` command:
       ```bash
       docker run --rm \
         --env-file /workspace/.infra_cd_env \
         -v <workDir_absolute_path>:/workspace \
         -w /workspace \
         <job.Image> \
         sh .infra_cd_run.sh
       ```
    4. Stream the output of `docker run` back to the UI logs using the existing `streamCommand` method.
    5. Clean up the `.infra_cd_run.sh` and `.infra_cd_env` files after execution finishes.

---

## Verification Plan

### Automated Tests
* Create unit/integration tests in [executor_test.go](file:///d:/go/infra-cd/apps/agent/internal/runner/executor_test.go) that mock `docker` execution or verify container command construction.
* Run agent unit tests:
  ```powershell
  go test -v ./internal/runner/...
  ```

### Manual Verification
1. Create a test project with a `.infra-cd.yaml` file that specifies a Docker image for a job, for example:
   ```yaml
   version: "1.0"
   jobs:
     - name: "Sandboxed Job"
       image: "node:20-alpine"
       script: |
         node -v
         pwd
   ```
2. Trigger the deployment and verify that:
   * The job execution log shows the Node.js version corresponding to the specified container image.
   * Files created during the job are saved in the mounted workspace.
