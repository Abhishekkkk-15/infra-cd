import { create } from 'zustand';
import type { Agent } from '../types';

interface AgentState {
  agents: Agent[];
  addAgent: (agent: Omit<Agent, 'id' | 'heartbeatAt' | 'cpuUsage' | 'ramUsage' | 'activeJobsCount'>) => Agent;
  updateAgentMetrics: (id: string, cpuUsage: number, ramUsage: number, activeJobsCount?: number) => void;
  setAgentStatus: (id: string, status: Agent['status']) => void;
  tickMetrics: () => void;
}

const initialAgents: Agent[] = [
  {
    id: 'agent-1',
    name: 'us-east-runner-01',
    ipAddress: '54.210.33.109',
    status: 'online',
    cpuUsage: 14.5,
    ramUsage: 42.1,
    capacity: 4,
    activeJobsCount: 0,
    os: 'Ubuntu 22.04 LTS (x86_64)',
    dockerVersion: '25.0.3',
    heartbeatAt: new Date().toISOString()
  },
  {
    id: 'agent-2',
    name: 'us-west-runner-02',
    ipAddress: '34.220.12.87',
    status: 'online',
    cpuUsage: 68.2,
    ramUsage: 78.5,
    capacity: 2,
    activeJobsCount: 1,
    os: 'Debian Bookworm 12',
    dockerVersion: '24.0.7',
    heartbeatAt: new Date().toISOString()
  },
  {
    id: 'agent-3',
    name: 'eu-central-runner-03',
    ipAddress: '3.120.98.241',
    status: 'offline',
    cpuUsage: 0,
    ramUsage: 0,
    capacity: 8,
    activeJobsCount: 0,
    os: 'Alpine Linux v3.19',
    dockerVersion: '26.0.0',
    heartbeatAt: new Date(Date.now() - 3600000 * 4).toISOString()
  }
];

export const useAgentStore = create<AgentState>((set) => ({
  agents: initialAgents,

  addAgent: (agentData) => {
    const id = `agent-${Math.random().toString(36).substr(2, 9)}`;
    const newAgent: Agent = {
      ...agentData,
      id,
      cpuUsage: 0,
      ramUsage: 0,
      activeJobsCount: 0,
      heartbeatAt: new Date().toISOString()
    };

    set((state) => ({
      agents: [...state.agents, newAgent]
    }));

    return newAgent;
  },

  updateAgentMetrics: (id, cpuUsage, ramUsage, activeJobsCount) => {
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === id
          ? {
              ...a,
              cpuUsage,
              ramUsage,
              ...(activeJobsCount !== undefined ? { activeJobsCount } : {}),
              heartbeatAt: new Date().toISOString()
            }
          : a
      )
    }));
  },

  setAgentStatus: (id, status) => {
    set((state) => ({
      agents: state.agents.map((a) =>
        a.id === id
          ? {
              ...a,
              status,
              cpuUsage: status === 'offline' ? 0 : a.cpuUsage,
              ramUsage: status === 'offline' ? 0 : a.ramUsage,
              heartbeatAt: new Date().toISOString()
            }
          : a
      )
    }));
  },

  tickMetrics: () => {
    // Fluctuates online agent resources randomly to simulate dynamic activity
    set((state) => ({
      agents: state.agents.map((a) => {
        if (a.status === 'offline') return a;

        // Slight drift in cpu and memory
        const cpuDelta = (Math.random() - 0.5) * 8; // -4% to +4%
        const ramDelta = (Math.random() - 0.5) * 3; // -1.5% to +1.5%

        const nextCpu = Math.max(5, Math.min(95, a.cpuUsage + cpuDelta));
        const nextRam = Math.max(10, Math.min(90, a.ramUsage + ramDelta));

        return {
          ...a,
          cpuUsage: parseFloat(nextCpu.toFixed(1)),
          ramUsage: parseFloat(nextRam.toFixed(1)),
          heartbeatAt: new Date().toISOString()
        };
      })
    }));
  }
}));
