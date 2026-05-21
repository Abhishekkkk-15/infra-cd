import axios, { AxiosError } from 'axios';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';
import { useProjectStore } from '../store/projectStore';
import { useAgentStore } from '../store/agentStore';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
const IS_MOCK = true; // Set to true to run fully client-side mock logic

// Create core Axios client
export const apiClient = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT Token
apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Error Normalization & Token Refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    // Normalize errors
    const normalizedError = {
      message: 'An unexpected error occurred.',
      status: error.response?.status || 500,
      details: error.response?.data || {},
      original: error,
    };

    if (error.response) {
      const data = error.response.data as { error?: string; message?: string } | null | undefined;
      normalizedError.message = data?.error || data?.message || error.message;

      // Handle token expiration/refresh if status is 401
      if (error.response.status === 401) {
        console.warn('Unauthorized request. Logging out user.');
        useAuthStore.getState().logout();
      }
    }

    return Promise.reject(normalizedError);
  }
);

// MOCK INTERCEPTOR
// Simulates API responses locally when IS_MOCK is enabled.
if (IS_MOCK) {
  apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    const url = config.url || '';
    const method = (config.method || 'get').toLowerCase();
    const data = config.data ? JSON.parse(config.data) : null;

    // Helper to return mock Axios response
    const mockResponse = (status: number, body: unknown): Promise<AxiosResponse> => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            data: body,
            status,
            statusText: status === 200 || status === 201 ? 'OK' : 'Error',
            headers: {},
            config,
          } as AxiosResponse);
        }, 300); // simulate short network latency
      });
    };

    // --- AUTH ROUTES ---
    if (url === '/auth/login' && method === 'post') {
      try {
        const user = await useAuthStore.getState().login(data.email, data.password);
        return mockResponse(200, user);
      } catch (e) {
        const err = e as Error;
        return Promise.reject({ status: 400, message: err.message });
      }
    }

    // --- PROJECT ROUTES ---
    if (url === '/projects' && method === 'get') {
      return mockResponse(200, useProjectStore.getState().projects);
    }

    if (url === '/projects' && method === 'post') {
      const newProject = useProjectStore.getState().addProject(data);
      return mockResponse(201, newProject);
    }

    const projectMatch = url.match(/^\/projects\/([^/]+)$/);
    if (projectMatch && method === 'get') {
      const id = projectMatch[1];
      const project = useProjectStore.getState().projects.find((p) => p.id === id);
      if (!project) return Promise.reject({ status: 404, message: 'Project not found' });
      return mockResponse(200, project);
    }

    if (projectMatch && method === 'delete') {
      const id = projectMatch[1];
      useProjectStore.getState().deleteProject(id);
      return mockResponse(200, { success: true });
    }

    // --- DEPLOYMENT ROUTES ---
    const projectDeploymentsMatch = url.match(/^\/projects\/([^/]+)\/deployments$/);
    if (projectDeploymentsMatch && method === 'get') {
      const projectId = projectDeploymentsMatch[1];
      const deployments = useProjectStore.getState().deployments.filter((d) => d.projectId === projectId);
      return mockResponse(200, deployments);
    }

    if (projectDeploymentsMatch && method === 'post') {
      const projectId = projectDeploymentsMatch[1];
      const newDeployment = useProjectStore.getState().triggerDeployment(projectId, 'manual');
      return mockResponse(201, newDeployment);
    }

    const deploymentMatch = url.match(/^\/deployments\/([^/]+)$/);
    if (deploymentMatch && method === 'get') {
      const id = deploymentMatch[1];
      const deployment = useProjectStore.getState().deployments.find((d) => d.id === id);
      if (!deployment) return Promise.reject({ status: 404, message: 'Deployment not found' });
      return mockResponse(200, deployment);
    }

    const rollbackMatch = url.match(/^\/deployments\/([^/]+)\/rollback$/);
    if (rollbackMatch && method === 'post') {
      const id = rollbackMatch[1];
      const oldDep = useProjectStore.getState().deployments.find((d) => d.id === id);
      if (!oldDep) return Promise.reject({ status: 404, message: 'Deployment not found' });
      const rollbackDep = useProjectStore.getState().triggerDeployment(oldDep.projectId, 'rollback', {
        hash: oldDep.commitHash,
        message: `Rollback to [${oldDep.commitHash}] - ${oldDep.commitMessage}`,
        author: 'System (Rollback)'
      });
      return mockResponse(201, rollbackDep);
    }

    // --- ENV VAR ROUTES ---
    const envVarMatch = url.match(/^\/projects\/([^/]+)\/env-vars$/);
    if (envVarMatch && method === 'post') {
      const projectId = envVarMatch[1];
      const newVar = useProjectStore.getState().addEnvVar(projectId, data);
      return mockResponse(201, newVar);
    }

    const envVarDetailMatch = url.match(/^\/projects\/([^/]+)\/env-vars\/([^/]+)$/);
    if (envVarDetailMatch && method === 'put') {
      const projectId = envVarDetailMatch[1];
      const varId = envVarDetailMatch[2];
      useProjectStore.getState().updateEnvVar(projectId, varId, data);
      const updatedVar = useProjectStore.getState().projects.find((p) => p.id === projectId)?.envVars.find((ev) => ev.id === varId);
      return mockResponse(200, updatedVar);
    }

    if (envVarDetailMatch && method === 'delete') {
      const projectId = envVarDetailMatch[1];
      const varId = envVarDetailMatch[2];
      useProjectStore.getState().deleteEnvVar(projectId, varId);
      return mockResponse(200, { success: true });
    }

    // --- WEBHOOK ROUTES ---
    const webhookMatch = url.match(/^\/projects\/([^/]+)\/webhooks$/);
    if (webhookMatch && method === 'post') {
      const projectId = webhookMatch[1];
      const newWebhook = useProjectStore.getState().addWebhook(projectId, data);
      return mockResponse(201, newWebhook);
    }

    const webhookDetailMatch = url.match(/^\/projects\/([^/]+)\/webhooks\/([^/]+)$/);
    if (webhookDetailMatch && method === 'put') {
      const projectId = webhookDetailMatch[1];
      const webId = webhookDetailMatch[2];
      useProjectStore.getState().updateWebhook(projectId, webId, data);
      const updatedWeb = useProjectStore.getState().projects.find((p) => p.id === projectId)?.webhooks.find((w) => w.id === webId);
      return mockResponse(200, updatedWeb);
    }

    if (webhookDetailMatch && method === 'delete') {
      const projectId = webhookDetailMatch[1];
      const webId = webhookDetailMatch[2];
      useProjectStore.getState().deleteWebhook(projectId, webId);
      return mockResponse(200, { success: true });
    }

    // --- AGENT ROUTES ---
    if (url === '/agents' && method === 'get') {
      return mockResponse(200, useAgentStore.getState().agents);
    }

    if (url === '/agents' && method === 'post') {
      const newAgent = useAgentStore.getState().addAgent(data);
      return mockResponse(201, newAgent);
    }

    const agentStatusMatch = url.match(/^\/agents\/([^/]+)\/status$/);
    if (agentStatusMatch && method === 'put') {
      const agentId = agentStatusMatch[1];
      useAgentStore.getState().setAgentStatus(agentId, data.status);
      return mockResponse(200, { success: true });
    }

    // --- SYSTEM ROUTES ---
    if (url === '/system/metrics' && method === 'get') {
      const agents = useAgentStore.getState().agents;
      const activeAgents = agents.filter((a) => a.status === 'online').length;
      const projects = useProjectStore.getState().projects;
      const deployments = useProjectStore.getState().deployments;
      const runningBuilds = deployments.filter((d) => d.status === 'running').length;
      const queuedBuilds = deployments.filter((d) => d.status === 'pending').length;

      // Average cpu and ram of online agents
      const onlineAgents = agents.filter((a) => a.status === 'online');
      const avgCpu = onlineAgents.length ? onlineAgents.reduce((sum, a) => sum + a.cpuUsage, 0) / onlineAgents.length : 0;
      const avgRam = onlineAgents.length ? onlineAgents.reduce((sum, a) => sum + a.ramUsage, 0) / onlineAgents.length : 0;

      // Simple mock historical data array
      const history = Array.from({ length: 12 }).map((_, idx) => {
        const time = new Date(Date.now() - (12 - idx) * 300000);
        return {
          timestamp: `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`,
          cpu: Math.max(5, Math.floor(avgCpu + (Math.sin(idx) * 8))),
          ram: Math.max(10, Math.floor(avgRam + (Math.cos(idx) * 3))),
          queue: Math.max(0, queuedBuilds + (idx % 2 === 0 ? 1 : 0)),
          deployments: Math.max(0, runningBuilds + (idx % 3 === 0 ? 1 : 0)),
        };
      });

      return mockResponse(200, {
        cpuUsage: parseFloat(avgCpu.toFixed(1)),
        ramUsage: parseFloat(avgRam.toFixed(1)),
        runningBuilds,
        queuedBuilds,
        activeAgents,
        totalProjects: projects.length,
        history,
      });
    }

    if (url === '/system/logs' && method === 'get') {
      return mockResponse(200, useProjectStore.getState().activityLogs);
    }

    // Fallback error
    console.error(`Mock Interceptor: Route ${method.toUpperCase()} ${url} not mocked.`);
    return Promise.reject({ status: 404, message: 'Resource not found in mock database' });
  });
}

// Request cancellation helper
export const createCancelToken = () => {
  const controller = new AbortController();
  return {
    signal: controller.signal,
    cancel: () => controller.abort(),
  };
};
