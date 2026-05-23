import type {
  Project,
  Deployment,
  EnvVar,
  Webhook,
  ActivityLog,
} from "../types";
import { create } from "zustand";

interface ProjectState {
  projects: Project[];
  deployments: Deployment[];
  activityLogs: ActivityLog[];
  addProject: (
    project: Omit<
      Project,
      | "id"
      | "createdAt"
      | "lastDeploymentStatus"
      | "lastDeploymentTime"
      | "envVars"
      | "webhooks"
    >,
  ) => Project;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  addEnvVar: (projectId: string, envVar: Omit<EnvVar, "id">) => EnvVar;
  updateEnvVar: (
    projectId: string,
    id: string,
    updates: Partial<EnvVar>,
  ) => void;
  deleteEnvVar: (projectId: string, id: string) => void;
  addWebhook: (
    projectId: string,
    webhook: Omit<Webhook, "id" | "deliveries">,
  ) => Webhook;
  updateWebhook: (
    projectId: string,
    id: string,
    updates: Partial<Webhook>,
  ) => void;
  deleteWebhook: (projectId: string, id: string) => void;
  triggerDeployment: (
    projectId: string,
    trigger: Deployment["trigger"],
    commit?: { hash?: string; message?: string; author?: string },
  ) => Deployment;
  updateDeployment: (id: string, updates: Partial<Deployment>) => void;
  addActivityLog: (log: Omit<ActivityLog, "id" | "timestamp">) => void;
  clearActivityLogs: () => void;
}

// Initial Mock Data
const initialProjects: Project[] = [
  {
    id: "proj-1",
    name: "api-gateway",
    repoUrl: "https://github.com/infra-cd/api-gateway",
    branch: "main",
    buildCommand: "go build -o server cmd/api/main.go",
    startCommand: "./server",
    isDockerized: true,
    pipeline_config: `# infra-cd build configuration\nversion: "1.0"\njobs:\n  - name: "Build API Gateway"\n    script: |\n      echo "Building Go API Gateway..."\n      go build -o server cmd/api/main.go\n`,
    envVars: [
      {
        id: "env-1",
        key: "PORT",
        value: "8080",
        isSecret: false,
        description: "Application port",
      },
      {
        id: "env-2",
        key: "DATABASE_URL",
        value: "postgres://postgres:*****@postgres.internal:5432/gateway",
        isSecret: true,
        description: "Connection to production database",
      },
      {
        id: "env-3",
        key: "JWT_SECRET",
        value: "super-secret-key-that-is-long-enough",
        isSecret: true,
        description: "JWT signature key",
      },
    ],
    webhooks: [
      {
        id: "web-1",
        name: "Slack Alerts",
        url: "https://example.com/mock-webhook",
        secret: "slack_secret_123",
        active: true,
        events: [
          "deployment.started",
          "deployment.success",
          "deployment.failed",
        ],
        deliveries: [
          {
            id: "del-1",
            event: "deployment.success",
            status: "success",
            statusCode: 200,
            durationMs: 145,
            createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
            payload: "{}",
            response: "ok",
          },
          {
            id: "del-2",
            event: "deployment.started",
            status: "success",
            statusCode: 200,
            durationMs: 112,
            createdAt: new Date(Date.now() - 3600000 * 2.1).toISOString(),
            payload: "{}",
            response: "ok",
          },
        ],
      },
    ],
    lastDeploymentStatus: "success",
    lastDeploymentTime: new Date(Date.now() - 3600000 * 2).toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 15).toISOString(),
  },
  {
    id: "proj-2",
    name: "web-dashboard",
    repoUrl: "https://github.com/infra-cd/web-dashboard",
    branch: "production",
    buildCommand: "npm run build",
    startCommand: "npm run start",
    isDockerized: false,
    envVars: [
      {
        id: "env-4",
        key: "VITE_API_URL",
        value: "https://api.infra-cd.dev",
        isSecret: false,
      },
      {
        id: "env-5",
        key: "VITE_ANALYTICS_KEY",
        value: "ua-12345-6",
        isSecret: false,
      },
    ],
    webhooks: [],
    lastDeploymentStatus: "success",
    lastDeploymentTime: new Date(Date.now() - 3600000 * 12).toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
  },
  {
    id: "proj-3",
    name: "payment-worker",
    repoUrl: "https://github.com/infra-cd/payment-worker",
    branch: "main",
    buildCommand: "npm run build",
    startCommand: "node dist/index.js",
    isDockerized: true,
    envVars: [
      {
        id: "env-6",
        key: "STRIPE_SECRET_KEY",
        value: "sk_live_51N...883x",
        isSecret: true,
      },
      {
        id: "env-7",
        key: "AMQP_URL",
        value: "amqp://rabbitmq.internal:5672",
        isSecret: false,
      },
    ],
    webhooks: [
      {
        id: "web-2",
        name: "GitHub Webhook Receiver",
        url: "https://api.github.com/webhooks",
        secret: "gh_secret_456",
        active: false,
        events: ["push"],
        deliveries: [],
      },
    ],
    lastDeploymentStatus: "failed",
    lastDeploymentTime: new Date(Date.now() - 3600000 * 24).toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
];

const initialDeployments: Deployment[] = [
  {
    id: "dep-101",
    projectId: "proj-1",
    projectName: "api-gateway",
    commitHash: "7f9c2d1",
    commitMessage: "feat: add rate limiting middleware for public endpoints",
    commitAuthor: "Sarah Jenkins",
    status: "success",
    durationSeconds: 112,
    agentId: "agent-1",
    agentName: "us-east-runner-01",
    trigger: "webhook",
    createdAt: new Date(Date.now() - 3600000 * 2.1).toISOString(),
    startedAt: new Date(Date.now() - 3600000 * 2.1).toISOString(),
    completedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    steps: [
      {
        id: "step-1",
        name: "Git Checkout",
        status: "success",
        durationSeconds: 4,
        startedAt: new Date(Date.now() - 3600000 * 2.1).toISOString(),
        completedAt: new Date(Date.now() - 3600000 * 2.1 + 4000).toISOString(),
        logs: [
          "Checking out repo https://github.com/infra-cd/api-gateway",
          "Fetching branch main",
          "HEAD is now at 7f9c2d1 feat: add rate limiting middleware",
        ],
      },
      {
        id: "step-2",
        name: "Lint & Audit",
        status: "success",
        durationSeconds: 15,
        startedAt: new Date(Date.now() - 3600000 * 2.1 + 4000).toISOString(),
        completedAt: new Date(Date.now() - 3600000 * 2.1 + 19000).toISOString(),
        logs: [
          "Running golangci-lint run...",
          "No issues found!",
          "Audit checks passed.",
        ],
      },
      {
        id: "step-3",
        name: "Docker Build & Push",
        status: "success",
        durationSeconds: 78,
        startedAt: new Date(Date.now() - 3600000 * 2.1 + 19000).toISOString(),
        completedAt: new Date(Date.now() - 3600000 * 2.1 + 97000).toISOString(),
        logs: [
          "Sending build context to Docker daemon...",
          "Step 1/8 : FROM golang:1.22-alpine AS builder",
          "Step 2/8 : WORKDIR /app",
          "Step 3/8 : COPY go.mod go.sum ./",
          "Step 4/8 : RUN go mod download",
          "Step 5/8 : COPY . .",
          "Step 6/8 : RUN go build -o server cmd/api/main.go",
          "Step 7/8 : FROM alpine:3.19",
          "Step 8/8 : COPY --from=builder /app/server /app/server",
          "Successfully built 28d49a71b3cf",
          "Pushing image to registry.infra-cd.internal/api-gateway:latest...",
          "Pushed successfully!",
        ],
      },
      {
        id: "step-4",
        name: "Deploy Container",
        status: "success",
        durationSeconds: 15,
        startedAt: new Date(Date.now() - 3600000 * 2.1 + 97000).toISOString(),
        completedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        logs: [
          "Connecting to Docker agent us-east-runner-01...",
          "Stopping existing container API-Gateway-Production...",
          "Removing container API-Gateway-Production...",
          "Creating container API-Gateway-Production...",
          "Starting container on port 8080...",
          "Running healthcheck http://localhost:8080/health...",
          "Healthcheck passed! Service is online.",
        ],
      },
    ],
  },
  {
    id: "dep-102",
    projectId: "proj-2",
    projectName: "web-dashboard",
    commitHash: "b391cf8",
    commitMessage: "fix: align terminal container styling on logs panel",
    commitAuthor: "Alex Mercer",
    status: "success",
    durationSeconds: 84,
    agentId: "agent-2",
    agentName: "us-west-runner-02",
    trigger: "manual",
    createdAt: new Date(Date.now() - 3600000 * 12.1).toISOString(),
    startedAt: new Date(Date.now() - 3600000 * 12.1).toISOString(),
    completedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    steps: [
      {
        id: "step-1",
        name: "Git Checkout",
        status: "success",
        durationSeconds: 5,
        logs: [
          "Checking out repo https://github.com/infra-cd/web-dashboard",
          "Fetching branch production",
          "HEAD is now at b391cf8 fix: align terminal container styling",
        ],
      },
      {
        id: "step-2",
        name: "Install Dependencies",
        status: "success",
        durationSeconds: 32,
        logs: [
          "npm ci",
          "Added 942 packages in 32s",
          "Audited 943 packages in 1s",
        ],
      },
      {
        id: "step-3",
        name: "Build Asset Pack",
        status: "success",
        durationSeconds: 38,
        logs: [
          "npm run build",
          "Vite build starts...",
          "✓ 412 modules transformed.",
          "dist/index.html   0.45 kB",
          "dist/assets/index-b391cf8.js  142.10 kB │ gzip: 42.15 kB",
          "dist/assets/index-b391cf8.css  32.18 kB │ gzip:  8.12 kB",
          "Build finished.",
        ],
      },
      {
        id: "step-4",
        name: "Publish & Deploy",
        status: "success",
        durationSeconds: 9,
        logs: [
          "Deploying build assets to local static host...",
          "Pruning older assets...",
          "Setting up redirects...",
          "Assets updated successfully! Site is live.",
        ],
      },
    ],
  },
  {
    id: "dep-103",
    projectId: "proj-3",
    projectName: "payment-worker",
    commitHash: "ea3123b",
    commitMessage: "refactor: update Stripe webhook handler signature",
    commitAuthor: "Alex Mercer",
    status: "failed",
    durationSeconds: 43,
    agentId: "agent-1",
    agentName: "us-east-runner-01",
    trigger: "webhook",
    createdAt: new Date(Date.now() - 3600000 * 24.1).toISOString(),
    startedAt: new Date(Date.now() - 3600000 * 24.1).toISOString(),
    completedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    steps: [
      {
        id: "step-1",
        name: "Git Checkout",
        status: "success",
        durationSeconds: 3,
        logs: [
          "Checking out repo https://github.com/infra-cd/payment-worker",
          "Fetching branch main",
          "HEAD is now at ea3123b refactor: update Stripe webhook",
        ],
      },
      {
        id: "step-2",
        name: "Install Dependencies",
        status: "success",
        durationSeconds: 22,
        logs: ["npm ci", "Added 482 packages in 22s"],
      },
      {
        id: "step-3",
        name: "Code Compilation",
        status: "failed",
        durationSeconds: 18,
        logs: [
          "npm run build",
          "TypeScript compilation starts...",
          "src/handlers/stripe.ts(14,24): error TS2339: Property 'constructEvent' does not exist on type 'typeof import(\"stripe\")'.",
          "src/handlers/stripe.ts(28,9): error TS7006: Parameter 'req' implicitly has an 'any' type.",
          "Found 2 errors in src/handlers/stripe.ts",
          "❌ Build failed. Exit code 1.",
        ],
      },
    ],
  },
];

const initialActivityLogs: ActivityLog[] = [
  {
    id: "act-1",
    type: "deployment",
    message:
      "Deployment of api-gateway (7f9c2d1) succeeded on us-east-runner-01",
    severity: "success",
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: "act-2",
    type: "webhook",
    message: "Slack Alerts webhook triggered for api-gateway (delivery 200 OK)",
    severity: "info",
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: "act-3",
    type: "deployment",
    message:
      "Deployment of web-dashboard (b391cf8) succeeded on us-west-runner-02",
    severity: "success",
    timestamp: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
  {
    id: "act-4",
    type: "deployment",
    message: "Deployment of payment-worker (ea3123b) failed during compilation",
    severity: "error",
    timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
  {
    id: "act-5",
    type: "secret",
    message: "User updated environment variables for api-gateway",
    severity: "warning",
    timestamp: new Date(Date.now() - 3600000 * 26).toISOString(),
  },
  {
    id: "act-6",
    type: "agent",
    message: "Agent us-west-runner-02 connected and is active",
    severity: "success",
    timestamp: new Date(Date.now() - 3600000 * 30).toISOString(),
  },
];

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: initialProjects,
  deployments: initialDeployments,
  activityLogs: initialActivityLogs,

  addProject: (projectData) => {
    const id = `proj-${Math.random().toString(36).substr(2, 9)}`;
    const newProject: Project = {
      ...projectData,
      id,
      envVars: [],
      webhooks: [],
      lastDeploymentStatus: "pending",
      lastDeploymentTime: "",
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      projects: [...state.projects, newProject],
      activityLogs: [
        {
          id: `act-${Date.now()}`,
          type: "project",
          message: `Project ${newProject.name} created successfully`,
          severity: "success",
          timestamp: new Date().toISOString(),
        },
        ...state.activityLogs,
      ],
    }));

    return newProject;
  },

  updateProject: (id, updates) => {
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, ...updates } : p,
      ),
    }));
  },

  deleteProject: (id) => {
    const project = get().projects.find((p) => p.id === id);
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      deployments: state.deployments.filter((d) => d.projectId !== id),
      activityLogs: [
        {
          id: `act-${Date.now()}`,
          type: "project",
          message: `Project ${project ? project.name : id} was deleted`,
          severity: "warning",
          timestamp: new Date().toISOString(),
        },
        ...state.activityLogs,
      ],
    }));
  },

  addEnvVar: (projectId, envVarData) => {
    const id = `env-${Math.random().toString(36).substr(2, 9)}`;
    const newVar: EnvVar = { ...envVarData, id };

    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id === projectId) {
          return { ...p, envVars: [...p.envVars, newVar] };
        }
        return p;
      }),
      activityLogs: [
        {
          id: `act-${Date.now()}`,
          type: "secret",
          message: `Added environment variable ${newVar.key} to project ${state.projects.find((p) => p.id === projectId)?.name}`,
          severity: "info",
          timestamp: new Date().toISOString(),
        },
        ...state.activityLogs,
      ],
    }));

    return newVar;
  },

  updateEnvVar: (projectId, id, updates) => {
    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id === projectId) {
          return {
            ...p,
            envVars: p.envVars.map((ev) =>
              ev.id === id ? { ...ev, ...updates } : ev,
            ),
          };
        }
        return p;
      }),
    }));
  },

  deleteEnvVar: (projectId, id) => {
    const keyName = get()
      .projects.find((p) => p.id === projectId)
      ?.envVars.find((ev) => ev.id === id)?.key;
    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id === projectId) {
          return {
            ...p,
            envVars: p.envVars.filter((ev) => ev.id !== id),
          };
        }
        return p;
      }),
      activityLogs: [
        {
          id: `act-${Date.now()}`,
          type: "secret",
          message: `Deleted environment variable ${keyName || id} from project ${state.projects.find((p) => p.id === projectId)?.name}`,
          severity: "warning",
          timestamp: new Date().toISOString(),
        },
        ...state.activityLogs,
      ],
    }));
  },

  addWebhook: (projectId, webhookData) => {
    const id = `web-${Math.random().toString(36).substr(2, 9)}`;
    const newWebhook: Webhook = { ...webhookData, id, deliveries: [] };

    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id === projectId) {
          return { ...p, webhooks: [...p.webhooks, newWebhook] };
        }
        return p;
      }),
      activityLogs: [
        {
          id: `act-${Date.now()}`,
          type: "webhook",
          message: `Added webhook ${newWebhook.name} to project ${state.projects.find((p) => p.id === projectId)?.name}`,
          severity: "info",
          timestamp: new Date().toISOString(),
        },
        ...state.activityLogs,
      ],
    }));

    return newWebhook;
  },

  updateWebhook: (projectId, id, updates) => {
    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id === projectId) {
          return {
            ...p,
            webhooks: p.webhooks.map((w) =>
              w.id === id ? { ...w, ...updates } : w,
            ),
          };
        }
        return p;
      }),
    }));
  },

  deleteWebhook: (projectId, id) => {
    const webhookName = get()
      .projects.find((p) => p.id === projectId)
      ?.webhooks.find((w) => w.id === id)?.name;
    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id === projectId) {
          return {
            ...p,
            webhooks: p.webhooks.filter((w) => w.id !== id),
          };
        }
        return p;
      }),
      activityLogs: [
        {
          id: `act-${Date.now()}`,
          type: "webhook",
          message: `Deleted webhook ${webhookName || id} from project ${state.projects.find((p) => p.id === projectId)?.name}`,
          severity: "warning",
          timestamp: new Date().toISOString(),
        },
        ...state.activityLogs,
      ],
    }));
  },

  triggerDeployment: (projectId, trigger, commit) => {
    const project = get().projects.find((p) => p.id === projectId);
    if (!project) throw new Error("Project not found");

    const id = `dep-${Math.random().toString(36).substr(2, 9)}`;
    const hashes = ["9a2c1f8", "fe77b10", "cd92ba5", "e3a102c"];
    const chosenHash =
      commit?.hash || hashes[Math.floor(Math.random() * hashes.length)];
    const messages = [
      "refactor: cleanup unused config endpoints",
      "fix: handle empty environment config in setup",
      "docs: update installation instructions",
      "perf: cache API response in worker",
    ];
    const chosenMessage =
      commit?.message || messages[Math.floor(Math.random() * messages.length)];
    const authors = ["Alex Mercer", "Sarah Jenkins", "Dev User"];
    const chosenAuthor =
      commit?.author || authors[Math.floor(Math.random() * authors.length)];

    const defaultSteps = [
      {
        id: "step-1",
        name: "Git Checkout",
        status: "pending" as const,
        logs: [],
      },
      {
        id: "step-2",
        name: "Lint & Audit",
        status: "pending" as const,
        logs: [],
      },
      {
        id: "step-3",
        name: project.isDockerized ? "Docker Build & Push" : "Code Compilation",
        status: "pending" as const,
        logs: [],
      },
      {
        id: "step-4",
        name: project.isDockerized ? "Deploy Container" : "Publish & Deploy",
        status: "pending" as const,
        logs: [],
      },
    ];

    const newDeployment: Deployment = {
      id,
      projectId,
      projectName: project.name,
      commitHash: chosenHash,
      commitMessage: chosenMessage,
      commitAuthor: chosenAuthor,
      status: "pending",
      durationSeconds: 0,
      steps: defaultSteps,
      agentId: "agent-1",
      agentName: "us-east-runner-01",
      trigger,
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
    };

    set((state) => ({
      deployments: [newDeployment, ...state.deployments],
      projects: state.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              lastDeploymentStatus: "running",
              lastDeploymentTime: new Date().toISOString(),
            }
          : p,
      ),
      activityLogs: [
        {
          id: `act-${Date.now()}`,
          type: "deployment",
          message: `Deployment triggered for ${project.name} (${chosenHash}) via ${trigger}`,
          severity: "info",
          timestamp: new Date().toISOString(),
        },
        ...state.activityLogs,
      ],
    }));

    return newDeployment;
  },

  updateDeployment: (id, updates) => {
    set((state) => {
      const updatedDeployments = state.deployments.map((d) => {
        if (d.id === id) {
          const updated = { ...d, ...updates };
          // If the status updated, also sync back to the project last status
          if (updates.status && updates.status !== d.status) {
            setTimeout(() => {
              get().updateProject(d.projectId, {
                lastDeploymentStatus: updates.status,
                lastDeploymentTime:
                  updated.completedAt || new Date().toISOString(),
              });

              // Add activity log on finish
              if (updates.status === "success" || updates.status === "failed") {
                get().addActivityLog({
                  type: "deployment",
                  message: `Deployment ${d.id} for ${d.projectName} finished with status: ${updates.status.toUpperCase()}`,
                  severity: updates.status === "success" ? "success" : "error",
                });

                // Deliver slack webhooks if any
                const project = get().projects.find(
                  (p) => p.id === d.projectId,
                );
                if (project && project.webhooks.length > 0) {
                  project.webhooks.forEach((w) => {
                    if (
                      w.active &&
                      w.events.includes(`deployment.${updates.status}`)
                    ) {
                      const deliveryId = `del-${Math.random().toString(36).substr(2, 9)}`;
                      const newDelivery = {
                        id: deliveryId,
                        event: `deployment.${updates.status}`,
                        status: "success" as const,
                        statusCode: 200,
                        durationMs: Math.floor(Math.random() * 100) + 50,
                        createdAt: new Date().toISOString(),
                        payload: JSON.stringify({
                          deploymentId: d.id,
                          projectName: d.projectName,
                          status: updates.status,
                          commit: d.commitHash,
                        }),
                        response:
                          '{"status":"ok","message":"notification sent"}',
                      };

                      set((s) => ({
                        projects: s.projects.map((p) => {
                          if (p.id === d.projectId) {
                            return {
                              ...p,
                              webhooks: p.webhooks.map((web) =>
                                web.id === w.id
                                  ? {
                                      ...web,
                                      deliveries: [
                                        newDelivery,
                                        ...web.deliveries,
                                      ],
                                    }
                                  : web,
                              ),
                            };
                          }
                          return p;
                        }),
                      }));
                    }
                  });
                }
              }
            }, 0);
          }
          return updated;
        }
        return d;
      });

      return { deployments: updatedDeployments };
    });
  },

  addActivityLog: (logData) => {
    set((state) => ({
      activityLogs: [
        {
          ...logData,
          id: `act-${Date.now()}`,
          timestamp: new Date().toISOString(),
        },
        ...state.activityLogs,
      ].slice(0, 100), // limit to 100 logs
    }));
  },

  clearActivityLogs: () => set({ activityLogs: [] }),
}));
