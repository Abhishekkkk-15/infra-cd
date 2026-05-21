import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  GitBranch, 
  ExternalLink, 
  Play, 
  ShieldAlert,
  Eye, 
  EyeOff, 
  Trash2, 
  Radio,
  Copy,
  Clock,
  User
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import { apiClient } from '../../api';
import { StatusBadge } from '../../components/common/Metrics';
import type { Project, Deployment } from '../../types';
import { useNotification } from '../../hooks/useNotification';

// Zod schemas for env vars and webhooks forms
const envVarSchema = z.object({
  key: z.string().min(1, 'Key is required').regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Invalid env variable key name'),
  value: z.string().min(1, 'Value is required'),
  isSecret: z.boolean().default(false),
  description: z.string().optional(),
});
type EnvVarForm = z.infer<typeof envVarSchema>;

const webhookSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  url: z.string().url('Please enter a valid webhook URL'),
  secret: z.string().min(1, 'Webhook secret is required'),
  active: z.boolean().default(true),
});
type WebhookForm = z.infer<typeof webhookSchema>;

// Monaco default YAML template
const defaultYamlConfig = `# infra-cd build configuration
version: "1.0"
pipeline:
  stages:
    - checkout
    - lint
    - build
    - deploy

  checkout:
    image: alpine/git:latest
    commands:
      - git clone --depth=1 \${INFRA_REPO_URL} .

  lint:
    image: node:20-alpine
    commands:
      - npm ci
      - npm run lint

  build:
    dockerfile: Dockerfile
    image_tag: registry.infra-cd.internal/\${INFRA_PROJECT_NAME}:latest
    push: true

  deploy:
    orchestrator: kubernetes
    replicas: 2
    port: 8080
    healthcheck: /health
`;

export const ProjectDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notification = useNotification();
  const [activeTab, setActiveTab] = useState<'overview' | 'deployments' | 'secrets' | 'webhooks' | 'build-config' | 'settings'>('overview');

  // Secrets manager UI states
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});
  const [yamlConfig, setYamlConfig] = useState(defaultYamlConfig);

  // Zod form binding
  const { register: registerEnv, handleSubmit: handleEnvSubmit, reset: resetEnv, formState: { errors: envErrors } } = useForm<EnvVarForm>({
    resolver: zodResolver(envVarSchema),
    defaultValues: { key: '', value: '', isSecret: false, description: '' }
  });

  const { register: registerWeb, handleSubmit: handleWebSubmit, reset: resetWeb, formState: { errors: webErrors } } = useForm<WebhookForm>({
    resolver: zodResolver(webhookSchema),
    defaultValues: { name: '', url: '', secret: 'hook_secret_sign_123', active: true }
  });

  // Query Project details
  const { data: projectBase, isLoading: isProjectLoading, error: projectError } = useQuery<Project>({
    queryKey: ['project', id],
    queryFn: async () => {
      const res = await apiClient.get(`/projects/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  const { data: envVars = [] } = useQuery({
    queryKey: ['project-env', id],
    queryFn: async () => {
      const res = await apiClient.get(`/projects/${id}/env`);
      return res.data;
    },
    enabled: !!id,
  });

  const { data: webhooks = [] } = useQuery({
    queryKey: ['project-webhooks', id],
    queryFn: async () => {
      const res = await apiClient.get(`/projects/${id}/webhooks`);
      return res.data;
    },
    enabled: !!id,
  });

  const project = projectBase ? { ...projectBase, envVars, webhooks } : undefined;

  // Query Project Deployments
  const { data: deployments = [] } = useQuery<Deployment[]>({
    queryKey: ['project-deployments', id],
    queryFn: async () => {
      const res = await apiClient.get(`/projects/${id}/deployments`);
      return res.data;
    },
    enabled: !!id,
    refetchInterval: 3000, // Sync build list dynamically
  });

  // Trigger Deployment mutation
  const triggerDeployMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/projects/${id}/deployments`);
      return res.data;
    },
    onSuccess: (newDep) => {
      queryClient.invalidateQueries({ queryKey: ['project-deployments', id] });
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      notification.success('Pipeline Started', `Deployment #${newDep.id.split('-')[1]} initiated.`);
      navigate(`/deployments/${newDep.id}`);
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Could not allocate build runner.';
      notification.error('Orchestration failed', message);
    }
  });

  // Env Var mutations
  const addEnvVarMutation = useMutation({
    mutationFn: async (data: EnvVarForm) => {
      return apiClient.post(`/projects/${id}/env`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-env', id] });
      notification.success('Variable Saved', 'Environment variable registered.');
      resetEnv();
    }
  });

  const deleteEnvVarMutation = useMutation({
    mutationFn: async (varId: string) => {
      return apiClient.delete(`/projects/${id}/env/${varId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-env', id] });
      notification.warning('Variable Deleted', 'Secret deleted from configurations.');
    }
  });

  // Webhook mutations
  const addWebhookMutation = useMutation({
    mutationFn: async (data: WebhookForm) => {
      return apiClient.post(`/projects/${id}/webhooks`, { ...data, events: ['push', 'deployment.success', 'deployment.failed'] });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-webhooks', id] });
      notification.success('Webhook Added', 'Listening endpoint registered.');
      resetWeb();
    }
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: async (webId: string) => {
      return apiClient.delete(`/projects/${id}/webhooks/${webId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-webhooks', id] });
      notification.warning('Webhook Deleted', 'Listening endpoint unregistered.');
    }
  });

  // Delete Project mutation
  const deleteProjectMutation = useMutation({
    mutationFn: async () => {
      return apiClient.delete(`/projects/${id}`);
    },
    onSuccess: () => {
      notification.warning('Project Deleted', 'Indexed files removed from node storage.');
      navigate('/projects');
    }
  });

  if (isProjectLoading) {
    return <div className="text-xs font-mono text-zinc-500 py-12">Querying database for configuration files...</div>;
  }

  if (projectError || !project) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ShieldAlert className="w-8 h-8 text-rose-500 mb-3" />
        <h3 className="text-sm font-bold text-zinc-300">Project index not found</h3>
        <p className="text-xs text-zinc-500 font-mono mt-1">Resource might have been garbage collected or deleted.</p>
        <button onClick={() => navigate('/projects')} className="mt-4 text-xs font-mono text-emerald-400 hover:underline">
          Return to projects
        </button>
      </div>
    );
  }

  const toggleSecretReveal = (key: string) => {
    setRevealedSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    notification.success('Copied to clipboard', `${label} copied.`);
  };

  // --- TABS RENDERING FUNCTIONS ---

  const renderOverview = () => {
    const recent = deployments.slice(0, 3);

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
        {/* Left: General configuration details card (Colspan 2) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h3 className="text-sm font-bold text-zinc-200 mb-4 border-b border-zinc-800/80 pb-2.5">Git Repository Config</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-850">
                <span className="text-zinc-500 block text-[10px] uppercase font-bold">Remote Origin</span>
                <a 
                  href={project.repoUrl} 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-zinc-300 hover:text-emerald-400 transition mt-1.5 inline-flex items-center gap-1 leading-normal"
                >
                  <span className="truncate max-w-[200px]">{project.repoUrl}</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </a>
              </div>

              <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-850">
                <span className="text-zinc-500 block text-[10px] uppercase font-bold">Build Branch</span>
                <span className="text-zinc-300 font-semibold block mt-1.5 flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  {project.branch}
                </span>
              </div>

              <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-850">
                <span className="text-zinc-500 block text-[10px] uppercase font-bold">Build Command</span>
                <span className="text-zinc-300 font-semibold block mt-1.5 text-[11px] truncate">
                  <code>{project.buildCommand}</code>
                </span>
              </div>

              <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-850">
                <span className="text-zinc-500 block text-[10px] uppercase font-bold">Start Script</span>
                <span className="text-zinc-300 font-semibold block mt-1.5 text-[11px] truncate">
                  <code>{project.startCommand}</code>
                </span>
              </div>
            </div>
          </div>

          {/* Activity timeline logs */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h3 className="text-sm font-bold text-zinc-200 mb-4 border-b border-zinc-800/80 pb-2.5">Timeline Activity</h3>
            {recent.length === 0 ? (
              <div className="text-center text-zinc-600 text-xs font-mono py-6">No historical runs recorded</div>
            ) : (
              <div className="space-y-4 relative pl-4 border-l border-zinc-800">
                {recent.map((d) => (
                  <div key={d.id} className="relative group">
                    {/* Node Dot */}
                    <span className="absolute -left-[21px] top-1.5 flex h-2.5 w-2.5 rounded-full bg-zinc-900 border border-zinc-800 items-center justify-center shrink-0">
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        d.status === 'success' ? 'bg-emerald-500' : d.status === 'failed' ? 'bg-rose-500' : 'bg-blue-500'
                      }`} />
                    </span>

                    <div 
                      onClick={() => navigate(`/deployments/${d.id}`)}
                      className="p-3 bg-zinc-950/60 hover:bg-zinc-900 border border-zinc-850 hover:border-zinc-800 rounded-lg transition cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-300">Deployment #{d.id.split('-')[1]}</span>
                        <StatusBadge status={d.status} />
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-2 font-mono truncate">
                        [{d.commitHash}] {d.commitMessage}
                      </p>
                      <div className="flex items-center justify-between text-[9px] text-zinc-550 font-mono mt-3">
                        <span className="flex items-center gap-1 text-zinc-500">
                          <User className="w-3 h-3" /> {d.commitAuthor}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {d.durationSeconds}s // {new Date(d.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right side overview metrics cards */}
        <div className="space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 text-left">
            <span className="text-[10px] font-mono font-bold tracking-wider text-zinc-500 uppercase">Indexing status</span>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm font-bold text-zinc-200">Active container</span>
              <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-emerald-500/5 text-emerald-400 border border-emerald-500/10">
                Healthy
              </span>
            </div>
            <div className="mt-4 pt-4 border-t border-zinc-800/60 space-y-2 text-[10px] font-mono text-zinc-500">
              <div className="flex justify-between">
                <span>Docker Container:</span>
                <span className="text-zinc-300">{project.isDockerized ? 'Enabled' : 'Disabled'}</span>
              </div>
              <div className="flex justify-between">
                <span>Secrets Indexed:</span>
                <span className="text-zinc-300">{project.envVars.length} variables</span>
              </div>
              <div className="flex justify-between">
                <span>Webhook events:</span>
                <span className="text-zinc-300">{project.webhooks.length} integrations</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderDeployments = () => {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 font-mono text-xs">
        <h3 className="text-sm font-bold text-zinc-200 mb-4 border-b border-zinc-800 pb-2.5 font-sans">Pipeline Execution History</h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-zinc-400 text-[11px]">
            <thead>
              <tr className="text-zinc-500 border-b border-zinc-800">
                <th className="pb-2 font-bold">PIPELINE RUN</th>
                <th className="pb-2 font-bold">COMMIT DETAILS</th>
                <th className="pb-2 font-bold">RUNNER AGENT</th>
                <th className="pb-2 font-bold">DURATION</th>
                <th className="pb-2 font-bold">TRIGGER</th>
                <th className="pb-2 font-bold">STATUS</th>
                <th className="pb-2 font-bold">EXECUTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40">
              {deployments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-650">No builds compiled for this repository</td>
                </tr>
              ) : (
                deployments.map((d) => (
                  <tr 
                    key={d.id} 
                    className="hover:bg-zinc-850/20 transition cursor-pointer"
                    onClick={() => navigate(`/deployments/${d.id}`)}
                  >
                    <td className="py-3 font-semibold text-zinc-300 font-sans">#{d.id.split('-')[1]}</td>
                    <td className="py-3">
                      <div className="flex flex-col">
                        <span className="text-zinc-200">[{d.commitHash}]</span>
                        <span className="text-[10px] text-zinc-500 font-sans truncate max-w-[160px]">{d.commitMessage}</span>
                      </div>
                    </td>
                    <td className="py-3 text-zinc-500">{d.agentName}</td>
                    <td className="py-3 text-zinc-300">{d.durationSeconds}s</td>
                    <td className="py-3 text-zinc-500">{d.trigger}</td>
                    <td className="py-3">
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="py-3 text-emerald-400 font-bold hover:underline">
                      View Logs →
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderEnvVars = () => {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-6">
        <div>
          <h3 className="text-sm font-bold text-zinc-200 font-sans">Secrets & Environment Variables</h3>
          <p className="text-[11px] text-zinc-500 font-mono mt-0.5">Encrypt credentials injected into build runtimes</p>
        </div>

        {/* Add Environment variable form */}
        <form onSubmit={handleEnvSubmit((data) => addEnvVarMutation.mutate(data))} className="p-4 bg-zinc-950 rounded-lg border border-zinc-850 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-1 font-mono text-[10px]">
            <span className="font-bold text-zinc-500">VARIABLE KEY</span>
            <input 
              {...registerEnv('key')}
              type="text" 
              placeholder="DATABASE_URL"
              className="w-full h-8 px-2.5 rounded bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-none"
            />
            {envErrors.key && <p className="text-[9px] text-rose-500 mt-0.5">{envErrors.key.message}</p>}
          </div>

          <div className="space-y-1 font-mono text-[10px]">
            <span className="font-bold text-zinc-500">VARIABLE VALUE</span>
            <input 
              {...registerEnv('value')}
              type="password" 
              placeholder="••••••••••••"
              className="w-full h-8 px-2.5 rounded bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-750 focus:outline-none"
            />
            {envErrors.value && <p className="text-[9px] text-rose-500 mt-0.5">{envErrors.value.message}</p>}
          </div>

          {/* Secret configuration */}
          <div className="flex items-center gap-4 h-8">
            <label className="flex items-center gap-2 text-[10px] font-mono font-bold text-zinc-500 uppercase cursor-pointer select-none">
              <input 
                {...registerEnv('isSecret')}
                type="checkbox" 
                className="rounded bg-zinc-900 border-zinc-800 text-emerald-500 focus:ring-0 focus:ring-offset-0"
              />
              <span>Encrypt Secret</span>
            </label>
          </div>

          <button
            type="submit"
            className="h-8 rounded bg-zinc-900 hover:bg-zinc-850 text-zinc-300 font-mono text-xs font-bold border border-zinc-800 hover:border-zinc-700 transition cursor-pointer"
          >
            Add Key
          </button>
        </form>

        {/* Variables listing */}
        <div className="space-y-2">
          {project.envVars.length === 0 ? (
            <div className="text-center text-zinc-600 font-mono text-xs py-8">No variables defined for this project</div>
          ) : (
            project.envVars.map((v) => {
              const isRevealed = revealedSecrets[v.id] || !v.isSecret;

              return (
                <div key={v.id} className="flex items-center justify-between p-3 bg-zinc-950/40 border border-zinc-850/60 rounded-lg hover:border-zinc-800 transition font-mono text-xs">
                  <div className="flex flex-col gap-1 pr-4 min-w-0">
                    <span className="font-bold text-zinc-300 truncate">{v.key}</span>
                    {v.isSecret && (
                      <span className="text-[8px] bg-zinc-900 text-amber-500/80 border border-amber-500/10 px-1 rounded self-start">
                        Secret
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Masked text field */}
                    <div className="text-zinc-400 bg-zinc-950 px-3 py-1 rounded border border-zinc-850 min-w-[120px] max-w-[200px] text-right truncate">
                      {isRevealed ? v.value : '••••••••••••'}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5">
                      {v.isSecret && (
                        <button
                          onClick={() => toggleSecretReveal(v.id)}
                          className="p-1 rounded text-zinc-550 hover:text-zinc-300 transition cursor-pointer"
                          title={isRevealed ? 'Hide Secret' : 'Reveal Secret'}
                        >
                          {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      )}

                      <button
                        onClick={() => copyToClipboard(v.value, v.key)}
                        className="p-1 rounded text-zinc-550 hover:text-zinc-300 transition cursor-pointer"
                        title="Copy value"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => deleteEnvVarMutation.mutate(v.id)}
                        className="p-1 rounded text-zinc-650 hover:text-red-400 hover:bg-red-500/5 transition cursor-pointer"
                        title="Delete variable"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const renderWebhooks = () => {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-6">
        <div>
          <h3 className="text-sm font-bold text-zinc-200 font-sans">Git Webhook Registrations</h3>
          <p className="text-[11px] text-zinc-500 font-mono mt-0.5">Trigger automated pipeline deployments on code push triggers</p>
        </div>

        {/* Add Webhook Form */}
        <form onSubmit={handleWebSubmit((data) => addWebhookMutation.mutate(data))} className="p-4 bg-zinc-950 rounded-lg border border-zinc-850 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1 font-mono text-[10px]">
              <span className="font-bold text-zinc-500">INTEGRATION NAME</span>
              <input 
                {...registerWeb('name')}
                type="text" 
                placeholder="Slack Notifications"
                className="w-full h-8 px-2.5 rounded bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-none"
              />
              {webErrors.name && <p className="text-[9px] text-rose-500 mt-0.5">{webErrors.name.message}</p>}
            </div>

            <div className="space-y-1 font-mono text-[10px] md:col-span-2">
              <span className="font-bold text-zinc-500">PAYLOAD URL</span>
              <input 
                {...registerWeb('url')}
                type="text" 
                placeholder="https://api.slack.com/services/..."
                className="w-full h-8 px-2.5 rounded bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-none"
              />
              {webErrors.url && <p className="text-[9px] text-rose-500 mt-0.5">{webErrors.url.message}</p>}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-zinc-850 pt-3">
            <div className="space-y-1 font-mono text-[10px]">
              <span className="font-bold text-zinc-500 block">WEBHOOK SECRET</span>
              <input 
                {...registerWeb('secret')}
                type="password" 
                placeholder="hook_secret_value"
                className="w-24 h-7 px-2 rounded bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-750 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="h-8 px-4 rounded bg-zinc-900 hover:bg-zinc-850 text-zinc-300 font-mono text-xs font-bold border border-zinc-800 hover:border-zinc-700 transition cursor-pointer"
            >
              Register Webhook
            </button>
          </div>
        </form>

        {/* Webhooks listing */}
        <div className="space-y-4">
          {project.webhooks.length === 0 ? (
            <div className="text-center text-zinc-650 font-mono text-xs py-8">No webhook integrations configured</div>
          ) : (
            project.webhooks.map((w) => (
              <div key={w.id} className="p-4 bg-zinc-950/40 border border-zinc-850/60 rounded-xl space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-850/50 pb-2">
                  <div className="flex items-center gap-2">
                    <Radio className="w-3.5 h-3.5 text-emerald-400 shrink-0 animate-pulse" />
                    <span className="text-xs font-bold text-zinc-200 font-sans">{w.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-[8px] font-mono border ${
                      w.active 
                        ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/10'
                        : 'bg-zinc-900 text-zinc-550 border-zinc-850'
                    }`}>
                      {w.active ? 'active' : 'inactive'}
                    </span>
                    <button
                      onClick={() => deleteWebhookMutation.mutate(w.id)}
                      className="p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-red-500/5 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="text-[10px] font-mono text-zinc-500 flex justify-between">
                  <span>URL: <span className="text-zinc-350">{w.url}</span></span>
                  <span>Secret: <span className="text-zinc-350">••••••••••</span></span>
                </div>

                {/* Delivery Logs */}
                <div className="space-y-1.5 pt-2">
                  <span className="text-[9px] font-mono font-bold tracking-wider text-zinc-500 uppercase block">Delivery Logs</span>
                  {w.deliveries.length === 0 ? (
                    <span className="text-[10px] font-mono text-zinc-650 block">No delivery logs recorded for this endpoint</span>
                  ) : (
                    w.deliveries.map((d) => (
                      <div key={d.id} className="flex items-center justify-between p-2 bg-zinc-950 border border-zinc-850 rounded text-[9px] font-mono">
                        <div className="flex items-center gap-2">
                          <span className={d.status === 'success' ? 'text-emerald-400' : 'text-rose-400'}>
                            {d.statusCode} {d.statusCode === 200 ? 'OK' : 'FAIL'}
                          </span>
                          <span className="text-zinc-500">event: {d.event}</span>
                        </div>
                        <div className="text-zinc-500">
                          {d.durationMs}ms // {new Date(d.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderBuildConfig = () => {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
        <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-zinc-200 font-sans">Build Rule Configuration</h3>
            <p className="text-[11px] text-zinc-500 font-mono mt-0.5">Edit `.infra-cd.yaml` pipeline build rules</p>
          </div>

          <button
            onClick={() => {
              notification.success('File Saved', 'Configuration saved to project environment.');
            }}
            className="flex items-center gap-1 px-3 h-8 rounded text-xs font-mono font-bold bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow transition cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>SAVE FILE</span>
          </button>
        </div>

        {/* Monaco Editor Wrapper */}
        <div className="border border-zinc-850 rounded-lg overflow-hidden h-96 w-full relative bg-[#1e1e1e]">
          <Editor
            height="100%"
            defaultLanguage="yaml"
            theme="vs-dark"
            value={yamlConfig}
            onChange={(val) => setYamlConfig(val || '')}
            options={{
              minimap: { enabled: false },
              fontSize: 12,
              fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace',
              lineHeight: 18,
              padding: { top: 12 },
              tabSize: 2,
              wordWrap: 'on',
            }}
          />
        </div>
      </div>
    );
  };

  const renderSettings = () => {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-6 font-mono text-xs">
        <h3 className="text-sm font-bold text-zinc-200 mb-4 border-b border-zinc-800 pb-2.5 font-sans">Project Environment Settings</h3>

        <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl space-y-3">
          <h4 className="text-sm font-bold text-red-400 flex items-center gap-1.5 font-sans">
            <ShieldAlert className="w-4 h-4" /> Danger Zone
          </h4>
          <p className="text-zinc-400 leading-relaxed font-sans text-xs">
            Deleting this project will permanently wipe all logs, webhook logs, configurations, and environment secrets from our runner database.
          </p>
          <button
            onClick={() => {
              if (confirm('CRITICAL WARN: Are you absolutely sure you want to delete this project? This is irreversible.')) {
                deleteProjectMutation.mutate();
              }
            }}
            className="h-8 px-4 rounded bg-red-500 hover:bg-red-650 text-white font-bold transition flex items-center gap-1 mt-2 cursor-pointer font-sans"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete Project Index
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Overview header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-850 pb-5 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-zinc-100 font-sans">{project.name}</h1>
            <StatusBadge status={project.lastDeploymentStatus} />
          </div>
          <div className="flex items-center gap-4 text-[10px] font-mono text-zinc-500 mt-2">
            <span>ID: {project.id}</span>
            <span>•</span>
            <span className="flex items-center gap-1 text-zinc-400">
              <GitBranch className="w-3 h-3 text-zinc-500" /> {project.branch}
            </span>
            <span>•</span>
            <span>Created {new Date(project.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Action triggers */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => triggerDeployMutation.mutate()}
            disabled={triggerDeployMutation.isPending}
            className="flex items-center gap-2 h-9 px-4 rounded-lg text-xs font-mono font-bold bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-lg shadow-emerald-500/5 transition cursor-pointer"
          >
            <Play className="w-4 h-4 shrink-0 fill-current" />
            <span>TRIGGER DEPLOYMENT</span>
          </button>
        </div>
      </div>

      {/* Tab select row */}
      <div className="flex border-b border-zinc-900 text-xs font-mono select-none overflow-x-auto whitespace-nowrap scrollbar-none">
        {(['overview', 'deployments', 'secrets', 'webhooks', 'build-config', 'settings'] as const).map((tab) => {
          const isActive = activeTab === tab;
          const labels = {
            overview: 'Overview',
            deployments: 'Deployments',
            secrets: 'Env Variables',
            webhooks: 'Webhooks',
            'build-config': 'Build Config',
            settings: 'Settings'
          };

          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`
                px-4 py-2.5 font-bold transition border-b-2 -mb-px cursor-pointer
                ${isActive 
                  ? 'text-zinc-100 border-emerald-500 font-semibold' 
                  : 'text-zinc-500 border-transparent hover:text-zinc-300'
                }
              `}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* Dynamic Tab view */}
      <div className="pt-2">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'deployments' && renderDeployments()}
        {activeTab === 'secrets' && renderEnvVars()}
        {activeTab === 'webhooks' && renderWebhooks()}
        {activeTab === 'build-config' && renderBuildConfig()}
        {activeTab === 'settings' && renderSettings()}
      </div>
    </div>
  );
};
export default ProjectDetails;
