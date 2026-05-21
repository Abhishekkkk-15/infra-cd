import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  GitBranch, 
  GitCommit, 
  Clock, 
  Server, 
  ArrowLeft,
  RotateCcw,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { API_URL, apiClient } from '../../api';
import { Terminal } from '../../components/terminal/Terminal';
import { useNotification } from '../../hooks/useNotification';
import type { Deployment, DeploymentStep } from '../../types';

export const DeploymentDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notification = useNotification();

  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Query Deployment details
  const { data: deployment, isLoading, error } = useQuery<Deployment>({
    queryKey: ['deployment', id],
    queryFn: async () => {
      const res = await apiClient.get(`/deployments/${id}`);
      return res.data;
    },
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data as Deployment | undefined;
      // Refetch if running or pending to update metadata
      if (data && (data.status === 'running' || data.status === 'pending')) {
        return 1500;
      }
      return false;
    }
  });

  // Rollback mutation
  const rollbackMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/deployments/${id}/rollback`);
      return res.data;
    },
    onSuccess: (newDep) => {
      notification.success('Rollback Triggered', `Initiating deployment rollback to commit ${newDep.commitHash}`);
      navigate(`/deployments/${newDep.id}`);
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Could not trigger rollback.';
      notification.error('Rollback failed', message);
    }
  });

  // Manage Live SSE Streaming
  useEffect(() => {
    if (!deployment || !id) return;

    // We can show previously recorded logs by iterating over steps
    if (deployment.status === 'success' || deployment.status === 'failed') {
      const logsToFeed: string[] = [];
      if (deployment.Steps) {
        deployment.Steps.forEach((step) => {
          logsToFeed.push(`\x1b[1m\x1b[36m--- Step: ${step.name} ---\x1b[0m\r\n`);
          if (step.output) {
            logsToFeed.push(step.output.replace(/\n/g, '\r\n') + '\r\n');
          }
        });
      }
      setTerminalLogs(logsToFeed);
      return;
    }

    // Connect to SSE stream
    setTerminalLogs([]);
    const es = new EventSource(`${API_URL}/api/v1/deployments/${id}/logs/stream`);
    eventSourceRef.current = es;

    es.addEventListener('log', (e) => {
      try {
        const data = JSON.parse(e.data);
        const prefix = data.type === 'stderr' ? '\x1b[31m' : '';
        const suffix = data.type === 'stderr' ? '\x1b[0m' : '';
        setTerminalLogs((prev) => [...prev, `${prefix}${data.message}${suffix}\r\n`]);
      } catch (err) {
        console.error('Failed to parse log event', err);
      }
    });

    es.addEventListener('done', () => {
      es.close();
      queryClient.invalidateQueries({ queryKey: ['deployment', id] });
    });

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [id, deployment?.id, deployment?.status]);

  if (isLoading) {
    return <div className="text-xs font-mono text-zinc-500 py-12">Allocating log buffer streams...</div>;
  }

  if (error || !deployment) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <XCircle className="w-8 h-8 text-rose-500 mb-3" />
        <h3 className="text-sm font-bold text-zinc-300">Deployment records missing</h3>
        <p className="text-xs text-zinc-500 font-mono mt-1">Check project dashboard or network configs.</p>
        <button onClick={() => navigate('/')} className="mt-4 text-xs font-mono text-emerald-400 hover:underline">
          Return to dashboard
        </button>
      </div>
    );
  }

  // Get active step index (find first step that is running, or fallback to selected index)
  const getStepStatusIcon = (stepStatus: DeploymentStep['status']) => {
    switch (stepStatus) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-rose-500 shrink-0 animate-pulse" />;
      case 'running':
        return (
          <span className="relative flex h-3.5 w-3.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-blue-500"></span>
          </span>
        );
      default:
        return <span className="w-4 h-4 rounded-full border border-zinc-800 bg-zinc-950 shrink-0" />;
    }
  };

  return (
    <div className="space-y-6 font-sans select-none">
      {/* Top Header bar with navigation back */}
      <div className="flex items-center gap-3">
        <Link 
          to={`/projects/${deployment.project_id}`}
          className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-850 hover:text-zinc-200 transition cursor-pointer text-zinc-400"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-zinc-100">Pipeline Deployment</h1>
            <span className="text-xs font-mono text-zinc-500">#{deployment.id.split('-')[1]}</span>
          </div>
          <p className="text-[11px] text-zinc-500 font-mono mt-0.5">Project: {(deployment as any).Project?.name || deployment.project_id}</p>
        </div>

        {/* Deployments Rollback actions */}
        {deployment.status === 'success' && (
          <button
            onClick={() => {
              if (confirm(`Trigger rollback? This will compile a new deployment from commit ${deployment.commit_sha}`)) {
                rollbackMutation.mutate();
              }
            }}
            disabled={rollbackMutation.isPending}
            className="ml-auto flex items-center gap-2 h-9 px-3.5 rounded-lg text-xs font-mono font-bold border border-zinc-800 bg-zinc-900 hover:bg-zinc-850 hover:text-zinc-200 transition cursor-pointer text-zinc-400 shadow-md"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>ROLLBACK DEPLOYMENT</span>
          </button>
        )}
      </div>

      {/* Header Status Banner */}
      <div className={`p-5 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 select-none ${
        deployment.status === 'success' 
          ? 'bg-emerald-500/5 border-emerald-500/10'
          : deployment.status === 'failed'
            ? 'bg-rose-500/5 border-rose-500/10'
            : 'bg-blue-500/5 border-blue-500/10'
      }`}>
        {/* Left: Commit info and branch */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-zinc-400 font-mono text-xs">
            <GitCommit className="w-4 h-4 text-zinc-500 shrink-0" />
            <span className="font-bold text-zinc-200">[{deployment.commit_sha || 'N/A'}]</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <GitBranch className="w-3.5 h-3.5 text-zinc-500 shrink-0" /> {(deployment as any).Project?.name || 'repo'}/{(deployment as any).Project?.branch || 'main'}
            </span>
          </div>
          <h2 className="text-sm font-semibold text-zinc-100 font-sans tracking-tight pt-1">
            {deployment.commit_message || 'Manual Deployment Trigger'}
          </h2>
          <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-1.5 pt-1">
            <span>Author: API/Web</span>
            <span>•</span>
            <span>Triggered via Web UI</span>
          </div>
        </div>

        {/* Right: duration, status and machine metrics */}
        <div className="flex items-center gap-6 text-right shrink-0">
          <div className="font-mono text-xs text-zinc-400 space-y-1">
            <div className="flex justify-between md:justify-end gap-3 items-center">
              <span className="text-zinc-550 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Duration</span>
              <span className="font-bold text-zinc-200">
                {deployment.started_at && deployment.finished_at 
                  ? Math.round((new Date(deployment.finished_at).getTime() - new Date(deployment.started_at).getTime()) / 1000) + 's' 
                  : (deployment.status === 'running' ? 'running...' : '-')}
              </span>
            </div>
            <div className="flex justify-between md:justify-end gap-3 items-center pt-1">
              <span className="text-zinc-550 flex items-center gap-1"><Server className="w-3.5 h-3.5" /> Agent</span>
              <span className="text-zinc-300 font-semibold">{(deployment as any).Agent?.name || 'Pool'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Body Split Panel: Visual Steps (Left) + Terminal Logs (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* LEFT COLUMN: Blue-Ocean/Railway style build steps */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
          <div>
            <h3 className="text-xs font-mono font-bold tracking-wider text-zinc-500 uppercase">Pipeline Stages</h3>
            <p className="text-[11px] text-zinc-500 font-mono mt-0.5">Execution order of compiler layers</p>
          </div>

          <div className="space-y-2">
            {(deployment.Steps || deployment.steps || []).map((step) => {
              const isRunning = step.status === 'running';
              const isSuccess = step.status === 'success';
              const isFailed = step.status === 'failed';

              return (
                <div 
                  key={step.id}
                  className={`
                    flex items-center justify-between p-3 rounded-lg border transition font-mono text-xs select-none
                    ${isRunning 
                      ? 'bg-blue-500/5 border-blue-500/25 text-blue-400 font-semibold' 
                      : isSuccess
                        ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400/90'
                        : isFailed
                          ? 'bg-rose-500/5 border-rose-500/20 text-rose-400 font-semibold shadow-inner'
                          : 'bg-zinc-950/40 border-zinc-850/50 text-zinc-500'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    {getStepStatusIcon(step.status)}
                    <span>{step.name}</span>
                  </div>

                  {step.durationSeconds !== undefined && step.durationSeconds > 0 && (
                    <span className="text-[10px] text-zinc-500 font-mono">{step.durationSeconds}s</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: Terminal Stdout container */}
        <div className="lg:col-span-2">
          <Terminal logs={terminalLogs} />
        </div>

      </div>
    </div>
  );
};
export default DeploymentDetails;
