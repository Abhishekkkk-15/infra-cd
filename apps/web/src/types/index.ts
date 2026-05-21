export type DeploymentStatus = 'success' | 'running' | 'failed' | 'pending' | 'offline';

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  token?: string;
}

export interface EnvVar {
  id: string;
  key: string;
  value: string;
  isSecret: boolean;
  description?: string;
}

export interface WebhookDelivery {
  id: string;
  event: string;
  status: 'success' | 'failed';
  statusCode: number;
  durationMs: number;
  createdAt: string;
  payload: string;
  response: string;
}

export interface Webhook {
  id: string;
  name: string;
  url: string;
  secret: string;
  active: boolean;
  events: string[];
  deliveries: WebhookDelivery[];
}

export interface Project {
  id: string;
  name: string;
  repoUrl: string;
  branch: string;
  buildCommand: string;
  startCommand: string;
  isDockerized: boolean;
  envVars: EnvVar[];
  webhooks: Webhook[];
  lastDeploymentStatus: DeploymentStatus;
  lastDeploymentTime: string;
  createdAt: string;
}

export interface DeploymentStep {
  id: string;
  name: string;
  status: 'success' | 'running' | 'failed' | 'pending';
  durationSeconds?: number;
  startedAt?: string;
  completedAt?: string;
  logs: string[];
}

export interface Deployment {
  id: string;
  projectId: string;
  projectName: string;
  commitHash: string;
  commitMessage: string;
  commitAuthor: string;
  status: DeploymentStatus;
  durationSeconds: number;
  steps: DeploymentStep[];
  agentId: string;
  agentName: string;
  trigger: 'manual' | 'webhook' | 'rollback';
  createdAt: string;
  startedAt: string;
  completedAt?: string;
}

export interface Agent {
  id: string;
  name: string;
  ipAddress: string;
  status: 'online' | 'offline';
  cpuUsage: number;
  ramUsage: number;
  capacity: number;
  activeJobsCount: number;
  os: string;
  dockerVersion: string;
  heartbeatAt: string;
}

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

export interface ActivityLog {
  id: string;
  type: 'deployment' | 'agent' | 'project' | 'secret' | 'webhook';
  message: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'error' | 'success';
}
