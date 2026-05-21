import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Server, 
  Plus, 
  Copy
} from 'lucide-react';
import { apiClient } from '../../api';
import { StatusBadge } from '../../components/common/Metrics';
import type { Agent, Deployment } from '../../types';
import { useNotification } from '../../hooks/useNotification';

export const Agents: React.FC = () => {
  const queryClient = useQueryClient();
  const notification = useNotification();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  // Query Agents list
  const { data: agents = [], isLoading } = useQuery<Agent[]>({
    queryKey: ['agents-list'],
    queryFn: async () => {
      const res = await apiClient.get('/agents');
      return res.data;
    },
    refetchInterval: 3000, // Dynamic updates
  });

  // Query deployments to map recent jobs per runner
  const { data: deployments = [] } = useQuery<Deployment[]>({
    queryKey: ['all-deployments'],
    queryFn: async () => {
      const res = await apiClient.get('/projects');
      const allDeploys: Deployment[] = [];
      for (const p of res.data) {
        const dRes = await apiClient.get(`/projects/${p.id}/deployments`);
        allDeploys.push(...dRes.data);
      }
      return allDeploys;
    }
  });

  // Add Agent mutation
  const addAgentMutation = useMutation({
    mutationFn: async (data: { name: string; ipAddress: string; os: string; dockerVersion: string; capacity: number }) => {
      const res = await apiClient.post('/agents', data);
      return res.data;
    },
    onSuccess: (newAgent) => {
      queryClient.invalidateQueries({ queryKey: ['agents-list'] });
      notification.success('Agent Provisioned', `Runner ${newAgent.name} registered and waiting for daemon connection.`);
      setIsModalOpen(false);
    }
  });

  const handleRegisterAgent = () => {
    // Generate a random mock runner
    const suffix = Math.floor(Math.random() * 90) + 10;
    addAgentMutation.mutate({
      name: `eu-west-runner-${suffix}`,
      ipAddress: `18.197.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      os: 'Ubuntu 24.04 LTS (aarch64)',
      dockerVersion: '26.1.1',
      capacity: 4
    });
  };

  const handleCopyInstallCmd = () => {
    const cmd = 'curl -fsSL https://get.infra-cd.dev/agent.sh | sh -s -- --token icd_tok_84a2f8b0ea12 --server https://console.infra-cd.dev';
    navigator.clipboard.writeText(cmd);
    setCopiedText(true);
    notification.success('Copied install script', 'Ready to run in terminal.');
    setTimeout(() => setCopiedText(false), 2000);
  };

  // Metric averages
  const onlineAgents = agents.filter((a) => a.status === 'online');
  const totalCapacity = onlineAgents.reduce((sum, a) => sum + a.capacity, 0);
  const activeJobs = onlineAgents.reduce((sum, a) => sum + a.activeJobsCount, 0);

  return (
    <div className="space-y-6 font-sans select-none">
      
      {/* Title Header */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100">Runner Orchestrators</h1>
          <p className="text-xs text-zinc-500 font-mono mt-0.5">Connected self-hosted VM agent containers</p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 h-9 px-4 rounded-lg text-xs font-mono font-bold bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-lg shadow-emerald-500/5 transition cursor-pointer"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span>PROVISION RUNNER</span>
        </button>
      </div>

      {/* Cluster Load Statistics Header */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between h-24">
          <span className="text-[10px] font-mono font-bold tracking-wider text-zinc-500 uppercase">Agent Nodes Status</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-xl font-bold text-zinc-100 font-mono">{onlineAgents.length} / {agents.length}</span>
            <span className="text-[10px] font-mono text-zinc-500">running online</span>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between h-24">
          <span className="text-[10px] font-mono font-bold tracking-wider text-zinc-500 uppercase">Cluster Pipeline Slot Load</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-xl font-bold text-zinc-100 font-mono">{activeJobs} / {totalCapacity}</span>
            <span className="text-[10px] font-mono text-zinc-500">slots occupied</span>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between h-24">
          <span className="text-[10px] font-mono font-bold tracking-wider text-zinc-500 uppercase">Provisioning Mode</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-sm font-bold text-emerald-400 font-sans tracking-tight">Active Standalone</span>
          </div>
        </div>
      </div>

      {/* Agents Grid List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isLoading ? (
          <div className="col-span-2 text-xs font-mono text-zinc-550 py-12">Polling orchestrator status...</div>
        ) : (
          agents.map((a) => {
            // Find recent jobs of this agent
            const agentJobs = deployments
              .filter((d) => d.agentId === a.id)
              .sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime())
              .slice(0, 3);

            return (
              <div 
                key={a.id}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between space-y-5"
              >
                {/* Header Row */}
                <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-zinc-200">{a.name}</h3>
                      <StatusBadge status={a.status === 'online' ? 'online' : 'offline'} />
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500 block">IP Address: {a.ipAddress}</span>
                  </div>

                  <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-850/80 text-zinc-500">
                    <Server className="w-4 h-4" />
                  </div>
                </div>

                {/* Resource Metrics sliders */}
                {a.status === 'online' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-[10px] text-zinc-500">
                    <div className="space-y-2 p-3 bg-zinc-950/60 rounded-lg border border-zinc-850">
                      <div className="flex justify-between font-bold">
                        <span>CPU CORE LOAD</span>
                        <span className="text-zinc-300">{a.cpuUsage}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${a.cpuUsage > 75 ? 'bg-rose-500' : 'bg-emerald-400'}`}
                          style={{ width: `${a.cpuUsage}%` }}
                        />
                      </div>
                    </div>

                    <div className="space-y-2 p-3 bg-zinc-950/60 rounded-lg border border-zinc-850">
                      <div className="flex justify-between font-bold">
                        <span>MEMORY RAM LOAD</span>
                        <span className="text-zinc-300">{a.ramUsage}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                          style={{ width: `${a.ramUsage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-zinc-950 border border-zinc-850/50 rounded-lg text-center font-mono text-[10px] text-zinc-600">
                    Runner agent offline. Check local system logs.
                  </div>
                )}

                {/* Machine Details / Specs */}
                <div className="p-3 bg-zinc-950/40 rounded-lg border border-zinc-850/60 font-mono text-[10px] text-zinc-500 grid grid-cols-2 gap-2">
                  <div>
                    <span>OS Platform:</span>
                    <span className="text-zinc-350 block mt-0.5 truncate">{a.os}</span>
                  </div>
                  <div>
                    <span>Docker Daemon:</span>
                    <span className="text-zinc-350 block mt-0.5">{a.dockerVersion}</span>
                  </div>
                  <div className="pt-2">
                    <span>Task Capacity:</span>
                    <span className="text-zinc-300 font-bold block mt-0.5">{a.activeJobsCount} / {a.capacity} occupied</span>
                  </div>
                  <div className="pt-2">
                    <span>Last heartbeat:</span>
                    <span className="text-zinc-350 block mt-0.5">
                      {a.status === 'online' ? 'just now' : '4h ago'}
                    </span>
                  </div>
                </div>

                {/* Recent compilation Jobs on this Agent */}
                <div className="space-y-2">
                  <span className="text-[9px] font-mono font-bold tracking-wider text-zinc-500 uppercase block">Recent runner jobs</span>
                  {agentJobs.length === 0 ? (
                    <span className="text-[10px] font-mono text-zinc-650 block pl-1">No compile jobs assigned to runner</span>
                  ) : (
                    <div className="space-y-1">
                      {agentJobs.map((j) => (
                        <div key={j.id} className="flex items-center justify-between p-2 bg-zinc-950 border border-zinc-850/40 rounded text-[9px] font-mono">
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-zinc-400 font-semibold truncate max-w-[80px]">{j.projectName}</span>
                            <span className="text-zinc-550">[{j.commitHash}]</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-zinc-500">{j.durationSeconds}s</span>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              j.status === 'success' ? 'bg-emerald-500' : 'bg-rose-500'
                            }`} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* PROVISIONING AGENT COMMAND MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          
          {/* Panel */}
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden relative z-10 font-sans">
            <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-900 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold text-zinc-100">Provision Runner Node</h3>
                <p className="text-[10px] text-zinc-500 font-mono">Install client agent inside your host machine</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-xs font-mono text-zinc-550 hover:text-zinc-350 cursor-pointer"
              >
                close
              </button>
            </div>

            <div className="p-6 space-y-5 text-left">
              <p className="text-xs text-zinc-400 leading-relaxed">
                To connect a self-hosted server runner node, initialize Docker on the machine and execute our setup installation shell command.
              </p>

              {/* Install Terminal script box */}
              <div className="space-y-1.5 font-mono">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-zinc-550">SHELL SCRIPT CMD</span>
                  <button 
                    onClick={handleCopyInstallCmd}
                    className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer font-bold"
                  >
                    <Copy className="w-3 h-3" />
                    {copiedText ? 'copied!' : 'copy command'}
                  </button>
                </div>
                
                <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-850/80 text-[11px] text-zinc-300 break-all select-text font-mono leading-relaxed">
                  <code>curl -fsSL https://get.infra-cd.dev/agent.sh | sh -s -- --token icd_tok_84a2f8b0ea12 --server https://console.infra-cd.dev</code>
                </div>
              </div>

              {/* Setup requirements */}
              <div className="space-y-2 p-4 bg-zinc-950 rounded-lg border border-zinc-850/50 text-[10px] font-mono text-zinc-500">
                <span className="font-bold text-zinc-400 block pb-1 border-b border-zinc-900">Runner host specs requirements</span>
                <div className="flex justify-between">
                  <span>Operating System:</span>
                  <span className="text-zinc-300">Linux (amd64 / arm64)</span>
                </div>
                <div className="flex justify-between">
                  <span>Minimum CPU/RAM:</span>
                  <span className="text-zinc-300">1 Core // 1GB Ram</span>
                </div>
                <div className="flex justify-between">
                  <span>Engine dependency:</span>
                  <span className="text-zinc-300">Docker Daemon running</span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800 mt-6 font-mono">
                <button
                  onClick={handleRegisterAgent}
                  className="h-9 px-4 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-lg shadow-emerald-500/5 transition cursor-pointer"
                >
                  SIMULATE CLONE RUNNER NODE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Agents;
