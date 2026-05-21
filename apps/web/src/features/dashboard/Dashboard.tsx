import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  Play, 
  Layers, 
  Activity, 
  Terminal as TerminalIcon, 
  ArrowRight,
  Server
} from 'lucide-react';
import { apiClient } from '../../api';
import { MetricCard, StatusBadge } from '../../components/common/Metrics';
import type { Deployment, SystemMetrics, ActivityLog, Agent } from '../../types';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  // Query system metrics
  const { data: metrics, isLoading: isMetricsLoading } = useQuery<SystemMetrics>({
    queryKey: ['system-metrics'],
    queryFn: async () => {
      const res = await apiClient.get('/system/metrics');
      return res.data;
    },
    refetchInterval: 3000, // Refetch every 3s to capture metric fluctuations!
  });

  // Query activity logs
  const { data: activityLogs } = useQuery<ActivityLog[]>({
    queryKey: ['activity-logs'],
    queryFn: async () => {
      const res = await apiClient.get('/system/logs');
      return res.data;
    },
    refetchInterval: 3000,
  });

  // Query recent deployments
  const { data: recentDeployments } = useQuery<Deployment[]>({
    queryKey: ['recent-deployments'],
    queryFn: async () => {
      // Get deployments of all projects and slice top 5
      const res = await apiClient.get('/projects'); // to get project IDs
      const allDeploys: Deployment[] = [];
      for (const p of res.data) {
        const dRes = await apiClient.get(`/projects/${p.id}/deployments`);
        allDeploys.push(...dRes.data);
      }
      return allDeploys
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);
    },
    refetchInterval: 4000,
  });

  // Query agents
  const { data: agents } = useQuery<Agent[]>({
    queryKey: ['agents-list'],
    queryFn: async () => {
      const res = await apiClient.get('/agents');
      return res.data;
    },
    refetchInterval: 3000,
  });

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Title Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100">Console Overview</h1>
          <p className="text-xs text-zinc-500 font-mono mt-0.5">cluster.orchestrator.node-01</p>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Deployments"
          value={metrics?.runningBuilds ?? 0}
          icon={Play}
          description="Build pipelines compiling"
          trend={{ value: 'Live stream', isPositive: true }}
          isLoading={isMetricsLoading}
        />
        <MetricCard
          title="Orchestrator Queue"
          value={metrics?.queuedBuilds ?? 0}
          icon={Layers}
          description="Pipelines waiting for agents"
          trend={{ value: '0.0s latency', isPositive: true }}
          isLoading={isMetricsLoading}
        />
        <MetricCard
          title="Connected Runners"
          value={`${metrics?.activeAgents ?? 0}/${agents?.length ?? 0}`}
          icon={Server}
          description="Self-hosted build servers online"
          isLoading={isMetricsLoading}
        />
        <MetricCard
          title="Total Projects"
          value={metrics?.totalProjects ?? 0}
          icon={TerminalIcon}
          description="Monitored docker & script repos"
          isLoading={isMetricsLoading}
        />
      </motion.div>

      {/* Main Charts & Statistics Panel */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Recharts Graphs (Colspan 2) */}
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-800/60 pb-4">
            <div>
              <h3 className="text-sm font-bold text-zinc-100">Cluster Resource Load</h3>
              <p className="text-[11px] text-zinc-500 font-mono">CPU and RAM usage averages across running runner agents</p>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-mono">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2 h-2 rounded bg-emerald-500"></span> CPU Avg ({metrics?.cpuUsage}%)
              </span>
              <span className="flex items-center gap-1.5 text-indigo-400">
                <span className="w-2 h-2 rounded bg-indigo-500"></span> Memory Avg ({metrics?.ramUsage}%)
              </span>
            </div>
          </div>

          {/* Area Chart Container */}
          <div className="h-64 w-full">
            {metrics?.history ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics.history} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cpuColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="ramColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="timestamp" stroke="#4b5563" fontSize={9} tickLine={false} />
                  <YAxis stroke="#4b5563" fontSize={9} tickLine={false} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px' }}
                    labelClassName="text-zinc-400 font-mono text-[10px]"
                    itemStyle={{ color: '#f4f4f5', fontStyle: 'monospace', fontSize: '11px' }}
                  />
                  <Area type="monotone" dataKey="cpu" name="CPU Usage %" stroke="#10b981" strokeWidth={1.5} fillOpacity={1} fill="url(#cpuColor)" />
                  <Area type="monotone" dataKey="ram" name="RAM Usage %" stroke="#6366f1" strokeWidth={1.5} fillOpacity={1} fill="url(#ramColor)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center text-zinc-600 text-xs font-mono">
                Compiling graph layers...
              </div>
            )}
          </div>
        </div>

        {/* Right: Live Activity Log (Colspan 1) */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col h-full">
          <div className="flex items-center justify-between border-b border-zinc-800/60 pb-4 mb-4">
            <div>
              <h3 className="text-sm font-bold text-zinc-100">Live Activity Feed</h3>
              <p className="text-[11px] text-zinc-500 font-mono">Real-time audit log notifications</p>
            </div>
            <Activity className="w-4 h-4 text-zinc-600 animate-pulse" />
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 max-h-64 pr-1 font-mono text-[10px]">
            {activityLogs && activityLogs.length > 0 ? (
              activityLogs.map((log) => {
                const colors = {
                  success: 'text-emerald-400 border-emerald-500/10 bg-emerald-500/5',
                  error: 'text-rose-400 border-rose-500/10 bg-rose-500/5',
                  warning: 'text-amber-400 border-amber-500/10 bg-amber-500/5',
                  info: 'text-blue-400 border-blue-500/10 bg-blue-500/5',
                };
                const col = colors[log.severity] || colors.info;
                const time = new Date(log.timestamp);
                const formatTime = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}:${time.getSeconds().toString().padStart(2, '0')}`;

                return (
                  <div key={log.id} className={`p-2.5 rounded-lg border leading-relaxed flex flex-col gap-1 ${col}`}>
                    <div className="flex justify-between font-bold">
                      <span className="uppercase tracking-wider">[{log.type}]</span>
                      <span className="opacity-60">{formatTime}</span>
                    </div>
                    <p className="text-zinc-300 font-sans">{log.message}</p>
                  </div>
                );
              })
            ) : (
              <div className="h-full flex items-center justify-center text-zinc-600 text-xs font-mono py-8">
                Listening for console signals...
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Row 3: Recent Jobs & Active Runner Nodes */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Recent Deployments Table (Colspan 2) */}
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between border-b border-zinc-800/60 pb-4 mb-4">
            <div>
              <h3 className="text-sm font-bold text-zinc-100">Recent Build Deployments</h3>
              <p className="text-[11px] text-zinc-500 font-mono">Historical records of automated build and runner triggers</p>
            </div>
            <Link to="/projects" className="text-xs font-mono text-zinc-500 hover:text-zinc-300 transition flex items-center gap-1">
              All projects <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-[11px] text-zinc-400 border-collapse">
              <thead>
                <tr className="text-zinc-500 border-b border-zinc-800/80">
                  <th className="pb-2.5 font-bold">PROJECT</th>
                  <th className="pb-2.5 font-bold">COMMIT</th>
                  <th className="pb-2.5 font-bold">STATUS</th>
                  <th className="pb-2.5 font-bold">DURATION</th>
                  <th className="pb-2.5 font-bold">RUNNER</th>
                  <th className="pb-2.5 font-bold">TRIGGER</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {recentDeployments && recentDeployments.length > 0 ? (
                  recentDeployments.map((d) => (
                    <tr 
                      key={d.id} 
                      className="hover:bg-zinc-850/30 transition cursor-pointer"
                      onClick={() => navigate(`/deployments/${d.id}`)}
                    >
                      <td className="py-3 font-semibold text-zinc-300 font-sans">{d.projectName}</td>
                      <td className="py-3">
                        <div className="flex flex-col">
                          <span className="text-zinc-200">[{d.commitHash}]</span>
                          <span className="text-[9px] text-zinc-500 font-sans truncate max-w-[150px]">{d.commitMessage}</span>
                        </div>
                      </td>
                      <td className="py-3">
                        <StatusBadge status={d.status} />
                      </td>
                      <td className="py-3 text-zinc-300">{d.durationSeconds}s</td>
                      <td className="py-3 text-zinc-500">{d.agentName}</td>
                      <td className="py-3 text-zinc-500">{d.trigger}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-zinc-600">
                      No deployments triggered yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Agent capacity health checks (Colspan 1) */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between border-b border-zinc-800/60 pb-4 mb-4">
            <div>
              <h3 className="text-sm font-bold text-zinc-100">Runner Node Load</h3>
              <p className="text-[11px] text-zinc-500 font-mono">Agent build engines and capacities</p>
            </div>
            <Link to="/agents" className="text-xs font-mono text-zinc-500 hover:text-zinc-300 transition flex items-center gap-1">
              Nodes <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-4">
            {agents && agents.length > 0 ? (
              agents.map((a) => (
                <div 
                  key={a.id}
                  className="p-3 bg-zinc-950/60 border border-zinc-850/50 rounded-lg hover:border-zinc-800 transition cursor-pointer"
                  onClick={() => navigate('/agents')}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-300">{a.name}</span>
                    <span className={`w-2 h-2 rounded-full ${a.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`}></span>
                  </div>

                  {a.status === 'online' ? (
                    <div className="mt-3 space-y-2 text-[10px] font-mono text-zinc-500">
                      {/* CPU slider */}
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span>CPU Usage</span>
                          <span className="text-zinc-300">{a.cpuUsage}%</span>
                        </div>
                        <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${a.cpuUsage > 75 ? 'bg-rose-500' : 'bg-emerald-400'}`}
                            style={{ width: `${a.cpuUsage}%` }}
                          />
                        </div>
                      </div>

                      {/* RAM slider */}
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span>Memory Usage</span>
                          <span className="text-zinc-300">{a.ramUsage}%</span>
                        </div>
                        <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                            style={{ width: `${a.ramUsage}%` }}
                          />
                        </div>
                      </div>

                      {/* Jobs capacity */}
                      <div className="flex justify-between text-[9px] pt-1">
                        <span>Jobs running: {a.activeJobsCount} / {a.capacity}</span>
                        <span>IP: {a.ipAddress}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 text-center text-[10px] font-mono text-zinc-600 py-2">
                      Agent node offline or unreachable
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center text-zinc-600 text-xs font-mono py-6">
                No runners registered
              </div>
            )}
          </div>
        </div>

      </motion.div>
    </motion.div>
  );
};
export default Dashboard;
