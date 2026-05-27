# infra-cd 🚀

**infra-cd** is a lightweight, self-hosted Continuous Deployment (CD) platform. It allows developers to register Git repositories (projects), manage environments, and orchestrate automated builds and deployments on remote target servers/machines via a lightweight agent.

---

## How It Works 

1. **Trigger**: A developer pushes code to GitHub, which sends a webhook to the `api` server, OR a user clicks "Deploy" in the web dashboard.
2. **Queue**: The `api` server creates a new Deployment record in the PostgreSQL database and sets its status to `pending`.
3. **Poll / Push**: The lightweight `agent` running on your deployment server maintains a WebSocket connection with the `api`. It receives a notification that a new deployment is ready.
4. **Execute**: The `agent` clones the repository, reads the `.infra-cd.yaml` (or fetches the overridden config from the DB), and begins executing the defined jobs (e.g., Docker builds, test scripts).
5. **Stream Logs**: As the agent runs the jobs, it streams standard output and standard error back to the `api` server in real-time.
6. **Live Dashboard**: The `web` dashboard receives these logs via Server-Sent Events (SSE) and displays them instantly to the user, updating the deployment status upon success or failure.

---

## Architecture & Monorepo Layout

This repository is organized as a Turborepo-managed monorepo using pnpm workspaces:

```text
infra-cd/
├── apps/
│   ├── api/        # Central Go REST API (Gin + GORM + PostgreSQL)
│   ├── web/        # React Web Dashboard (Vite + Monaco Editor + Tailwind)
│   └── agent/      # Lightweight VM Runner Agent (Go, polls API and runs pipelines)
├── packages/
│   └── email/        # Email service
├── turbo.json      # Turborepo build configuration
└── pnpm-workspace.yaml
```

---

## Features

- **Centralized Dashboard**: A modern, dark-mode dashboard to monitor project status, trigger deployments, rotate tokens, assign agents, and manage environment variables.
- **Lightweight Runner Agent**: A secure, Go-based agent that runs on your deployment VMs, polls the central server for jobs, clones repos, and executes pipeline commands.
- **Real-Time Logs**: View execution steps and real-time stderr/stdout logs in the dashboard via SSE.
- **Git Webhook Triggering**: Automatic pipeline triggers when code is pushed to your Git branches (supports GitHub webhooks).
- **Flexible Pipeline Config (`.infra-cd.yaml`)**: Define complex stages, sandboxed container runners (Docker), directories to cache, and monorepo directory filters.
- **Database-first Configuration & Git Synchronization**: Edit pipelines directly in the Web UI editor (stored in DB) OR commit them in your Git repo. When the agent deploys, it automatically synchronizes Git configurations back to the central server database.

---

## Quick Start

### Prerequisites

- **Go** (1.26 or higher)
- **Node.js** (22+ and pnpm)
- **PostgreSQL** (16+)

### Installation & Development

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/abhishekkkk-15/infra-cd.git
   cd infra-cd
   ```

2. **Install Dependencies**:
   ```bash
   pnpm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in `apps/api/` matching your database and environment settings:
   ```bash
   cp apps/api/.env.example apps/api/.env
   ```

4. **Run Database Migrations**:
   ```bash
   cd apps/api
   go run ./cmd/migrate
   ```

5. **Start Dev Servers (Monorepo)**:
   From the root directory, start all services (API, Web, and Agent dependencies) concurrently:
   ```bash
   pnpm dev
   ```
   * Dashboard will be available at `http://localhost:5173`
   * API Server will run at `http://localhost:8080`

---

## Running the Agent Standalone

If you want to run the agent on a remote VM (separate from the web dashboard and API):

1. Compile the agent:
   ```bash
   cd apps/agent
   go build -o infra-agent ./cmd/agent/main.go
   ```
2. Run the agent and pass the required environment variables. You will need to generate an Agent Token from the web dashboard first:
   ```bash
   INFRA_AGENT_TOKEN="your_generated_token" \
   INFRA_API_URL="https://your-api-domain.com" \
   ./infra-agent
   ```

---

## Pipeline Configuration (`.infra-cd.yaml`)

Define your build and deployment instructions inside a `.infra-cd.yaml` file in the root of your project or in your project's monorepo subdirectory.

### Configuration Format

```yaml
# infra-cd build configuration
version: "1.0"

# Directories to archive and restore between build runs
cache:
  - .go/cache
  - node_modules

# Sequential list of execution jobs
jobs:
  - name: "Build API Backend"
    script: |
      echo "Building Go API server..."
      go build -o api ./cmd/infra-cd/main.go
    paths:
      - apps/api/**      # Only run if files in this path change (monorepo filter)

  - name: "Run API Tests"
    script: |
      echo "Running Go tests..."
      go test ./...
    image: golang:1.26-alpine  # Run this job inside a sandboxed container
```

---

## Database-first UI Configuration

You can configure pipelines in two ways:
1. **Git Repository**: Save `.infra-cd.yaml` in your repository. The agent will read it on deployment and synchronize the configuration back to the web dashboard automatically.
2. **Web UI Editor**: Open the project details, click on the **Build Config** tab, write your YAML config in the Monaco editor, and click **SAVE FILE**. The agent will prioritize this database-stored configuration on subsequent deployment runs.

*To revert to using Git-based configuration files, clear all text in the Web UI editor and click **SAVE FILE**.*
