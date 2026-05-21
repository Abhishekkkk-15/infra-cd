// ─── Core Status Types ────────────────────────────────────────────────────────
export type DeploymentStatus = 'success' | 'running' | 'failed' | 'pending';
export type AgentStatus = 'online' | 'offline';
export type StepStatus = 'success' | 'running' | 'failed' | 'pending';
export type LogType = 'stdout' | 'stderr';

// ─── User ─────────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  name: string;
  role?: string;
  token?: string;
  created_at?: string;
  updated_at?: string;
}

// ─── Environment Variable ─────────────────────────────────────────────────────
// API returns: id, project_id, key, value (masked if secret), is_secret
export interface EnvVar {
  id: string;
  project_id: string;
  key: string;
  value: string;        // "***" if is_secret = true
  is_secret: boolean;
  created_at?: string;
  updated_at?: string;
}

// ─── Webhook ──────────────────────────────────────────────────────────────────
export interface Webhook {
  id: string;
  project_id: string;
  provider: string;     // "github" | "gitlab"
  secret: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// ─── Project ──────────────────────────────────────────────────────────────────
// Matches Go models.Project JSON output
export interface Project {
  id: string;
  name: string;
  description: string;
  repo_url: string;
  branch: string;
  build_path: string;
  is_dockerized: boolean;
  dockerfile_path: string;
  deploy_script: string;
  user_id: string;
  created_at: string;
  updated_at: string;

  // Derived/computed — populated by frontend from deployment list
  lastDeploymentStatus?: DeploymentStatus;
  lastDeploymentTime?: string;
  // Kept for compatibility with existing UI components
  repoUrl?: string;         // alias for repo_url
  isDockerized?: boolean;   // alias for is_dockerized
  envVars?: EnvVar[];       // populated from /env endpoint
  webhooks?: Webhook[];     // populated from /webhooks endpoint
}

// ─── Deployment Step ──────────────────────────────────────────────────────────
export interface DeploymentStep {
  id: string;
  deployment_id: string;
  name: string;
  command: string;
  order: number;
  status: StepStatus;
  output: string;
  created_at?: string;
  updated_at?: string;
}

// ─── Deployment ───────────────────────────────────────────────────────────────
export interface Deployment {
  id: string;
  project_id: string;
  agent_id?: string;
  status: DeploymentStatus;
  commit_sha: string;
  commit_message: string;
  branch: string;
  started_at?: string;
  finished_at?: string;
  created_at: string;
  updated_at: string;
  Steps?: DeploymentStep[];

  // Derived — populated by frontend
  projectName?: string;
  // Kept for compatibility with existing UI
  projectId?: string;       // alias for project_id
  commitHash?: string;      // alias for commit_sha
  commitMessage?: string;   // alias for commit_message
  agentId?: string;         // alias for agent_id
  durationSeconds?: number;
  createdAt?: string;       // alias for created_at
  steps?: DeploymentStep[]; // alias for Steps (lowercase)
}

// ─── Agent ────────────────────────────────────────────────────────────────────
export interface Agent {
  id: string;
  name: string;
  token: string;
  hostname: string;
  ip: string;
  status: AgentStatus;
  last_heartbeat?: string;
  created_at?: string;
  updated_at?: string;

  // Kept for compatibility with existing UI (mocked fields)
  ipAddress?: string;   // alias for ip
  cpuUsage?: number;
  ramUsage?: number;
  capacity?: number;
  activeJobsCount?: number;
  os?: string;
  dockerVersion?: string;
  heartbeatAt?: string;
}

// ─── System Metrics (frontend-computed) ───────────────────────────────────────
export interface SystemMetrics {
  cpuUsage: number;
  ramUsage: number;
  runningBuilds: number;
  queuedBuilds: number;
  activeAgents: number;
  totalProjects: number;
  history: Array<{
    timestamp: string;
    cpu: number;
    ram: number;
    queue: number;
    deployments: number;
  }>;
}

// ─── Activity Log (frontend-only) ─────────────────────────────────────────────
export interface ActivityLog {
  id: string;
  type: 'deployment' | 'agent' | 'project' | 'secret' | 'webhook';
  message: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'error' | 'success';
}
