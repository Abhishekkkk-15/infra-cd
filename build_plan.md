# infra-cd — Complete Build Plan

> Work top-to-bottom. Each phase builds on the previous one.  
> ✅ = already exists | 🔨 = needs to be built

---

## Phase 1 — Backend Foundation (API Core)

Get the Go API server wired up end-to-end with DB and all routes registered.

### 1.1 — DB & Migrations
- ✅ `internal/db/db.go` — GORM connection pool
- ✅ `internal/db/config.go` — DSN from env
- ✅ `internal/db/models/*` — All models defined
- 🔨 `cmd/migrate/main.go` — Run `AutoMigrate` for all models (User, Project, Deployment, DeploymentStep, DeploymentLog, Agent, EnvironmentVariable, Webhook)
- 🔨 `.env` — Add all required vars: `DATABASE_URL`, `PORT`, `APP_ENV`

### 1.2 — Router Setup
- 🔨 `cmd/infra-cd/main.go` — Register all route groups under `/api/v1`:
  - `/projects` group
  - `/agents` group
  - `/deployments` group
  - `/webhooks` group
- 🔨 Add CORS middleware (allow frontend origin)
- 🔨 Add auth middleware (JWT or token validation — use `x-api-key` for agent routes)

### 1.3 — Project CRUD Routes
- ✅ `handlers/project_handler.go` — `CreateProject`, `GetProjects` (partial)
- 🔨 Add `GetProjectByID` handler → `GET /projects/:id`
- 🔨 Add `UpdateProject` handler → `PUT /projects/:id`
- 🔨 Add `DeleteProject` handler → `DELETE /projects/:id`
- 🔨 Wire all 5 handlers into the router
- ✅ `services/project_service.go` — `Create`, `GetAll`, `GetByID`, `Delete`
- 🔨 Add `UpdateProject` to service

### 1.4 — Environment Variables Routes
- 🔨 `handlers/env_handler.go`
  - `GET /projects/:id/env` — list env vars (mask secret values)
  - `POST /projects/:id/env` — add env var
  - `DELETE /projects/:id/env/:envId` — delete env var
- 🔨 `services/env_service.go` — CRUD on `EnvironmentVariables`

### 1.5 — Agent Routes
- 🔨 `handlers/agent_handler.go`
  - `POST /agents` — register agent (returns token)
  - `GET /agents` — list all agents with status
  - `GET /agents/:id` — agent detail
  - `DELETE /agents/:id` — remove agent
  - `POST /agents/:id/heartbeat` — agent sends heartbeat (updates status + timestamp)
- 🔨 `services/agent_service.go` — CRUD + heartbeat logic
- 🔨 Heartbeat age checker: mark agent offline if `last_heartbeat > 30s` ago (run as goroutine in `main.go`)

---

## Phase 2 — Deployment Engine (Backend)

The core of the platform — triggering and tracking deployments.

### 2.1 — Deployment Routes
- 🔨 `handlers/deployment_handler.go`
  - `POST /projects/:id/deployments` — trigger a new deployment
  - `GET /projects/:id/deployments` — list deployments for project
  - `GET /deployments/:id` — get deployment detail with steps + logs
  - `GET /deployments/:id/logs` — stream deployment logs (SSE or polling)
- 🔨 `services/deployment_service.go`
  - `CreateDeployment(projectID)` — creates Deployment record (status=pending), queues job
  - `GetDeploymentsByProject(projectID)`
  - `GetDeploymentByID(id)`

### 2.2 — Deployment Job Execution Logic
- 🔨 `internal/deployment/runner.go` — Core deployment runner:
  - `RunDeployment(deploymentID)` — runs in a goroutine
  - Step 1: `git clone <repo_url> --branch <branch>`
  - Step 2: Load env vars from DB for the project
  - Step 3: If `is_dockerized`: `docker build` → `docker run`
  - Step 3 (alt): If shell script: execute `deploy_script`
  - Each step → create `DeploymentStep` record, update status
  - Stream stdout/stderr → create `DeploymentLog` records
  - On complete → update `Deployment.status` to `success` or `failed`
- 🔨 Assign deployment to an **online** agent (pick first available)
- 🔨 Mark `Deployment.AgentID` when assigned

### 2.3 — Deployment Log Streaming
- 🔨 `GET /deployments/:id/logs/stream` — SSE (Server-Sent Events) endpoint
  - Long-poll DB for new `DeploymentLog` rows while deployment is running
  - Close stream when status = `success` or `failed`

---

## Phase 3 — Agent Binary (`apps/agent`)

The lightweight daemon that runs on target VMs and executes deployments sent by the API.

### 3.1 — Agent Daemon
- 🔨 `apps/agent/cmd/agent/main.go` — Agent entry point
  - Read `AGENT_TOKEN` + `API_SERVER` from env
  - Start heartbeat loop: `POST /agents/:id/heartbeat` every 15s
  - Start job poller: `GET /agents/:id/pending-deployments` every 5s

### 3.2 — Job Execution on Agent
- 🔨 `apps/agent/internal/executor/executor.go`
  - Receive deployment job (projectID, repoURL, branch, env vars, deploy script)
  - Clone repo, run build steps
  - Stream logs back to API: `POST /deployments/:id/logs`
  - Report step status changes: `PATCH /deployments/:id/steps/:stepId`
  - Report final status: `PATCH /deployments/:id/status`

### 3.3 — Agent-API Communication Protocol
- 🔨 `GET /agents/:id/pending-deployments` — API returns pending jobs for this agent
- 🔨 `PATCH /deployments/:id/status` — agent updates deployment status
- 🔨 `PATCH /deployments/:id/steps/:stepId` — agent updates step status + output
- 🔨 `POST /deployments/:id/logs` — agent pushes log lines

---

## Phase 4 — Webhook Integration

Auto-trigger deployments on git push.

### 4.1 — Webhook Setup
- 🔨 `handlers/webhook_handler.go`
  - `POST /projects/:id/webhooks` — register webhook (generate secret)
  - `GET /projects/:id/webhooks` — list webhooks
  - `DELETE /projects/:id/webhooks/:webhookId`
  - `POST /webhooks/github` — GitHub webhook receiver (public endpoint)
  - `POST /webhooks/gitlab` — GitLab webhook receiver

### 4.2 — Webhook Verification & Dispatch
- 🔨 `internal/webhooks/github.go`
  - Verify `X-Hub-Signature-256` HMAC
  - Parse `push` event payload → extract `ref` (branch), `head_commit.id`, `head_commit.message`
  - Match to project by `repo_url` + `branch`
  - Call `deployment_service.CreateDeployment()`
- 🔨 `internal/webhooks/gitlab.go` — Same for GitLab push events

---

## Phase 5 — Frontend Wiring (Connect UI to Real API)

The frontend UI is largely built — just needs to talk to the real backend.

### 5.1 — API Client
- 🔨 `src/api/index.ts` — Configure axios base URL from env (`VITE_API_URL`)
- 🔨 `src/api/projects.ts` — typed API functions for projects
- 🔨 `src/api/deployments.ts` — typed API functions for deployments
- 🔨 `src/api/agents.ts` — typed API functions for agents
- 🔨 `src/api/env.ts` — typed API functions for env vars

### 5.2 — Types Alignment
- 🔨 `src/types/index.ts` — Align TypeScript types to match actual Go model JSON responses:
  - `Project`, `Deployment`, `DeploymentStep`, `DeploymentLog`, `Agent`, `EnvironmentVariable`

### 5.3 — Projects Page
- ✅ `Projects.tsx` — UI built
- 🔨 Fix form fields to match backend: `repo_url`, `branch`, `build_path`, `is_dockerized`, `dockerfile_path`, `deploy_script`
- 🔨 Wire `POST /projects` and `GET /projects` to real API

### 5.4 — Project Details Page
- ✅ `ProjectDetails.tsx` — UI built (~34KB, detailed)
- 🔨 Wire `GET /projects/:id` for project data
- 🔨 Wire `GET /projects/:id/deployments` for deployment list
- 🔨 Wire `POST /projects/:id/deployments` for manual deploy trigger
- 🔨 Wire `GET /projects/:id/env` for env vars panel
- 🔨 Wire env var add/delete mutations

### 5.5 — Deployment Details Page
- ✅ `DeploymentDetails.tsx` — UI built
- 🔨 Wire `GET /deployments/:id` for deployment data + steps
- 🔨 Wire log streaming: use `EventSource` to connect to `GET /deployments/:id/logs/stream`
- 🔨 Connect xterm terminal view to the log stream

### 5.6 — Agents Page
- ✅ `Agents.tsx` — UI built
- 🔨 Wire `GET /agents` (poll every 5s for live status)
- 🔨 Wire `POST /agents` for agent provisioning (generate token, show install script with real token)
- 🔨 Replace hardcoded install script URL with real API server URL from env

### 5.7 — Dashboard
- 🔨 `Dashboard.tsx` — Wire metrics:
  - Total projects count
  - Active deployments
  - Online agents count
  - Recent deployments list

### 5.8 — Auth
- 🔨 Decide: JWT (self-hosted) or Clerk (already in package.json)?
- 🔨 If JWT: add login form → `POST /auth/login` → store token in localStorage → attach to all API calls
- 🔨 If Clerk: configure `ClerkProvider` with your app keys, protect routes with `<SignedIn>`
- 🔨 Add `ProtectedRoute` wrapper in `App.tsx`

---

## Phase 6 — OpenAPI Contract Package

Keep frontend and backend in sync via typed contracts.

### 6.1 — Define Contracts
- 🔨 `packages/openapi/src/contracts/projects.ts` — ts-rest contract for all project routes
- 🔨 `packages/openapi/src/contracts/deployments.ts`
- 🔨 `packages/openapi/src/contracts/agents.ts`
- 🔨 `packages/openapi/src/contracts/env.ts`
- 🔨 `packages/openapi/src/contracts/webhooks.ts`
- 🔨 Update `contracts/index.ts` to merge all into `apiContract`

### 6.2 — Zod Schemas
- 🔨 `packages/zod/src/project.ts` — Zod schemas for Project, CreateProjectInput
- 🔨 `packages/zod/src/deployment.ts`
- 🔨 `packages/zod/src/agent.ts`
- 🔨 Share schemas between frontend forms and API contract

### 6.3 — Use Contract in Frontend
- 🔨 Replace bare `axios` calls in `src/api/` with `ts-rest` client using `apiContract`
- 🔨 Get full type-safety + autocompletion end-to-end

---

## Phase 7 — Production Hardening

Make it actually deployable and robust.

### 7.1 — Security
- 🔨 Rate limiting middleware on API (e.g., 100 req/min per IP)
- 🔨 Agent token validation middleware (check `Authorization: Bearer <token>` against DB)
- 🔨 CORS — lock down to frontend origin only in prod
- 🔨 Mask secret env var values in API responses (`value = "***"` if `is_secret = true`)
- 🔨 Webhook HMAC validation (already in plan above)

### 7.2 — Observability
- 🔨 Structured logging (use `log/slog` in Go — built-in since 1.21)
  - Log all requests, deployment events, agent heartbeats
- 🔨 Request ID middleware — add `X-Request-ID` header to every response
- 🔨 Health endpoint `/health` — return DB status too (ping check)
- 🔨 `/metrics` — basic counters: total deployments, success rate, active agents

### 7.3 — Deployment of the Platform Itself
- 🔨 `Dockerfile` for `apps/api` — multi-stage build (Go binary)
- 🔨 `Dockerfile` for `apps/agent` — slim binary image
- 🔨 `docker-compose.yml` — API + PostgreSQL + (optional Redis) for local dev
- 🔨 `apps/web` — static build via `vite build`, serve via nginx or Caddy

### 7.4 — Configuration & DevEx
- 🔨 `apps/api/.env.example` — document all env vars
- 🔨 `Taskfile.yml` (or `Makefile`) — common dev tasks:
  - `task dev` → start API
  - `task migrate` → run migrations
  - `task build` → build binary
  - `task agent` → start agent
- 🔨 Update root `README.md` with real setup steps

---

## Build Order (Recommended)

```
Phase 1 → Phase 2 → Phase 5 (partial: 5.1-5.4) → Phase 3 → Phase 5 (5.5-5.6) → Phase 4 → Phase 6 → Phase 7
```

Start with **Phase 1 + 2** so you have a working backend.  
Then do **Phase 5** so you can see results in the UI immediately.  
Add **Phase 3** (agent) when you're ready to test real deployments on a VM.  
**Phase 4** (webhooks) and **Phase 6** (contracts) can be done in parallel or at the end.  
**Phase 7** last, before you go live.

---

## Quick Reference: All API Endpoints

| Method | Path | Phase |
|---|---|---|
| `GET` | `/health` | ✅ Done |
| `POST` | `/projects` | 1.3 |
| `GET` | `/projects` | 1.3 |
| `GET` | `/projects/:id` | 1.3 |
| `PUT` | `/projects/:id` | 1.3 |
| `DELETE` | `/projects/:id` | 1.3 |
| `GET` | `/projects/:id/env` | 1.4 |
| `POST` | `/projects/:id/env` | 1.4 |
| `DELETE` | `/projects/:id/env/:envId` | 1.4 |
| `POST` | `/projects/:id/deployments` | 2.1 |
| `GET` | `/projects/:id/deployments` | 2.1 |
| `GET` | `/deployments/:id` | 2.1 |
| `GET` | `/deployments/:id/logs/stream` | 2.3 |
| `PATCH` | `/deployments/:id/status` | 3.3 |
| `PATCH` | `/deployments/:id/steps/:stepId` | 3.3 |
| `POST` | `/deployments/:id/logs` | 3.3 |
| `POST` | `/agents` | 1.5 |
| `GET` | `/agents` | 1.5 |
| `GET` | `/agents/:id` | 1.5 |
| `DELETE` | `/agents/:id` | 1.5 |
| `POST` | `/agents/:id/heartbeat` | 1.5 |
| `GET` | `/agents/:id/pending-deployments` | 3.3 |
| `POST` | `/projects/:id/webhooks` | 4.1 |
| `GET` | `/projects/:id/webhooks` | 4.1 |
| `DELETE` | `/projects/:id/webhooks/:webhookId` | 4.1 |
| `POST` | `/webhooks/github` | 4.2 |
| `POST` | `/webhooks/gitlab` | 4.2 |
