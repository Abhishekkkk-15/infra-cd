import React from 'react';
import type { LucideIcon } from 'lucide-react';
import type { DeploymentStatus } from '../../types';

interface StatusBadgeProps {
  status: DeploymentStatus | 'online' | 'offline';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const config = {
    success: {
      bg: 'bg-emerald-500/5',
      border: 'border-emerald-500/25',
      text: 'text-emerald-400',
      dot: 'bg-emerald-500',
      label: 'success'
    },
    running: {
      bg: 'bg-blue-500/5',
      border: 'border-blue-500/25',
      text: 'text-blue-400',
      dot: 'bg-blue-500',
      label: 'running'
    },
    failed: {
      bg: 'bg-rose-500/5',
      border: 'border-rose-500/25',
      text: 'text-rose-400',
      dot: 'bg-rose-500',
      label: 'failed'
    },
    pending: {
      bg: 'bg-amber-500/5',
      border: 'border-amber-500/25',
      text: 'text-amber-400',
      dot: 'bg-amber-500',
      label: 'pending'
    },
    offline: {
      bg: 'bg-zinc-800/10',
      border: 'border-zinc-800',
      text: 'text-zinc-500',
      dot: 'bg-zinc-500',
      label: 'offline'
    },
    online: {
      bg: 'bg-emerald-500/5',
      border: 'border-emerald-500/25',
      text: 'text-emerald-400',
      dot: 'bg-emerald-500',
      label: 'online'
    }
  };

  const current = config[status as keyof typeof config] || config.offline;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-mono font-medium shadow-sm transition-all duration-300 ${current.bg} ${current.border} ${current.text} ${className}`}>
      <span className={`relative flex h-1.5 w-1.5`}>
        {status === 'running' && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
        )}
        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${current.dot}`}></span>
      </span>
      <span>{current.label}</span>
    </span>
  );
};

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: {
    value: string | number;
    isPositive: boolean;
  };
  isLoading?: boolean;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon: Icon,
  description,
  trend,
  isLoading = false,
  className = ''
}) => {
  return (
    <div className={`bg-zinc-900 border border-zinc-800 rounded-xl p-5 relative overflow-hidden select-none hover:border-zinc-700 transition-all duration-300 shadow-md ${className}`}>
      {/* Background glow overlay */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-zinc-800/5 rounded-full filter blur-xl shrink-0"></div>

      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono uppercase font-bold tracking-wider text-zinc-500">{title}</span>
        <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800/80 text-zinc-400">
          <Icon className="w-4 h-4 text-zinc-400" />
        </div>
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        {isLoading ? (
          <div className="h-8 w-24 bg-zinc-800 animate-pulse rounded"></div>
        ) : (
          <span className="text-2xl font-bold tracking-tight text-zinc-100 font-sans">{value}</span>
        )}

        {trend && !isLoading && (
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
            trend.isPositive 
              ? 'text-emerald-400 bg-emerald-500/5 border border-emerald-500/10' 
              : 'text-rose-400 bg-rose-500/5 border border-rose-500/10'
          }`}>
            {trend.value}
          </span>
        )}
      </div>

      {description && !isLoading && (
        <p className="text-[11px] text-zinc-500 mt-2 font-mono truncate">{description}</p>
      )}
    </div>
  );
};
export default MetricCard;
