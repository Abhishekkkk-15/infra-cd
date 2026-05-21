import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FolderGit2, 
  Plus, 
  Search, 
  GitBranch, 
  Trash2, 
  ChevronRight
} from 'lucide-react';
import { apiClient } from '../../api';
import { StatusBadge } from '../../components/common/Metrics';
import type { Project } from '../../types';
import { useNotification } from '../../hooks/useNotification';

// Zod validation schema for creating a project
const projectSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').regex(/^[a-zA-Z0-9-_]+$/, 'Only letters, numbers, dashes, and underscores allowed'),
  repo_url: z.string().url('Please enter a valid Git URL (HTTP/HTTPS)'),
  branch: z.string().min(1, 'Branch name is required').default('main'),
  deploy_script: z.string().default(''),
  is_dockerized: z.boolean().default(true),
  dockerfile_path: z.string().default('Dockerfile'),
  description: z.string().default(''),
});

type ProjectFormFields = z.infer<typeof projectSchema>;

export const Projects: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notification = useNotification();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // React Hook Form setup
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProjectFormFields>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: '',
      repo_url: '',
      branch: 'main',
      deploy_script: '',
      is_dockerized: true,
      dockerfile_path: 'Dockerfile',
      description: '',
    }
  });

  // Query projects
  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ['projects-list'],
    queryFn: async () => {
      const res = await apiClient.get('/projects');
      return res.data;
    },
  });

  // Create Project mutation
  const createMutation = useMutation({
    mutationFn: async (data: ProjectFormFields) => {
      const res = await apiClient.post('/projects', data);
      return res.data;
    },
    onSuccess: (newProject) => {
      queryClient.invalidateQueries({ queryKey: ['projects-list'] });
      queryClient.invalidateQueries({ queryKey: ['system-metrics'] });
      // Auto-trigger a first deployment
      apiClient.post(`/projects/${newProject.id}/deployments`).catch(() => {});
      notification.success('Project Created', `Project "${newProject.name}" has been registered.`);
      setIsModalOpen(false);
      reset();
      navigate(`/projects/${newProject.id}`);
    },
    onError: (err: unknown) => {
      const message = (err as { message?: string })?.message || 'Failed to register project.';
      notification.error('Error creating project', message);
    }
  });

  // Delete Project mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects-list'] });
      queryClient.invalidateQueries({ queryKey: ['system-metrics'] });
      notification.warning('Project Deleted', 'Project was removed from console.');
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Failed to remove project.';
      notification.error('Error deleting project', message);
    }
  });

  const onSubmit = (data: ProjectFormFields) => {
    createMutation.mutate(data);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // prevent card click navigation
    if (confirm('Are you sure you want to delete this project? This will erase all deployment history.')) {
      deleteMutation.mutate(id);
    }
  };

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.repo_url || p.repoUrl || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Title Panel */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100 font-sans">Projects Directory</h1>
          <p className="text-xs text-zinc-500 font-mono mt-0.5">Manage repository integrations and deployment configs</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 h-9 px-4 rounded-lg text-xs font-mono font-bold bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-lg shadow-emerald-500/5 transition cursor-pointer"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span>NEW PROJECT</span>
        </button>
      </div>

      {/* Search Input Bar */}
      <div className="relative flex items-center max-w-md bg-zinc-900 border border-zinc-800 rounded-lg pr-4">
        <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 pointer-events-none" />
        <input
          type="text"
          placeholder="Search by project name, repo url..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-10 pl-10 pr-4 bg-transparent border-0 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-0 font-sans"
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            className="text-[10px] font-mono text-zinc-500 hover:text-zinc-300 transition cursor-pointer"
          >
            clear
          </button>
        )}
      </div>

      {/* Projects Grid View */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-44 bg-zinc-900/50 border border-zinc-800/80 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-zinc-900/10 border border-dashed border-zinc-800 rounded-xl text-center p-6">
          <FolderGit2 className="w-10 h-10 text-zinc-650 mb-3" />
          <h3 className="text-sm font-bold text-zinc-300">No projects indexed</h3>
          <p className="text-xs text-zinc-500 font-mono mt-1 max-w-sm">
            {searchQuery 
              ? `No search results matches "${searchQuery}"`
              : 'Add a project using a Git URL to begin automated Docker container orchestrations.'
            }
          </p>
          {!searchQuery && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-4 flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-mono font-bold bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add project</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((p) => (
            <motion.div
              key={p.id}
              layoutId={`project-card-${p.id}`}
              onClick={() => navigate(`/projects/${p.id}`)}
              className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700/80 rounded-xl p-5 flex flex-col justify-between h-44 hover:shadow-lg transition-all duration-300 cursor-pointer relative overflow-hidden group"
            >
              {/* Top Row: Name and Tech Badge */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-zinc-200 group-hover:text-emerald-400 transition-colors truncate pr-4">
                    {p.name}
                  </h3>
                  
                  {/* Technology Badge */}
                  <span className={`px-2 py-0.5 rounded text-[8px] font-mono border ${
                    p.isDockerized 
                      ? 'bg-blue-500/5 text-blue-400 border-blue-500/10'
                      : 'bg-yellow-500/5 text-yellow-400 border-yellow-500/10'
                  }`}>
                  {(p.is_dockerized ?? p.isDockerized) ? 'Dockerized' : 'Shell Script'}
                </span>
              </div>

              {/* Git repo info */}
              <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-mono truncate">
                <span className="truncate">{(p.repo_url || p.repoUrl || '').replace('https://', '')}</span>
              </div>
              </div>

              {/* Middle Row: Branch & Status */}
              <div className="flex items-center justify-between pt-3">
                <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-mono bg-zinc-950 px-2 py-0.5 rounded border border-zinc-850">
                  <GitBranch className="w-3 h-3 text-zinc-500 shrink-0" />
                  <span>{p.branch}</span>
                </div>
                
                <StatusBadge status={p.lastDeploymentStatus} />
              </div>

              {/* Bottom Row: Last deploy timestamp & Delete button */}
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-zinc-800/60 text-[10px] text-zinc-500 font-mono">
                <span>
                  {p.lastDeploymentTime 
                    ? `Deployed ${new Date(p.lastDeploymentTime).toLocaleDateString()}`
                    : 'Not deployed'
                  }
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => handleDelete(e, p.id)}
                    className="p-1 rounded text-zinc-650 hover:text-red-400 hover:bg-red-500/5 transition cursor-pointer"
                    title="Delete project"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* CREATE PROJECT MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden relative z-10 font-sans"
            >
              <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-900 flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-zinc-100">Index Git Repository</h3>
                  <p className="text-[10px] text-zinc-500 font-mono">Register new codebase for builds</p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="text-xs font-mono text-zinc-550 hover:text-zinc-350 cursor-pointer"
                >
                  close
                </button>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4 text-left">
                {/* Project Name */}
                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold tracking-wider text-zinc-500 uppercase">
                    Project Name
                  </label>
                  <input
                    {...register('name')}
                    type="text"
                    placeholder="my-payment-worker"
                    className="w-full h-9 px-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-650 focus:outline-none focus:border-zinc-700 transition"
                  />
                  {errors.name && (
                    <p className="text-[10px] text-rose-500 font-mono mt-0.5">{errors.name.message}</p>
                  )}
                </div>

                {/* Git Repository URL */}
                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold tracking-wider text-zinc-500 uppercase">
                    Git Repo URL
                  </label>
                  <input
                    {...register('repo_url')}
                    type="text"
                    placeholder="https://github.com/org/repo"
                    className="w-full h-9 px-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-650 focus:outline-none focus:border-zinc-700 transition"
                  />
                  {errors.repo_url && (
                    <p className="text-[10px] text-rose-500 font-mono mt-0.5">{errors.repo_url.message}</p>
                  )}
                </div>

                {/* Build branch and technology split */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold tracking-wider text-zinc-500 uppercase">
                      Git Branch
                    </label>
                    <input
                      {...register('branch')}
                      type="text"
                      placeholder="main"
                      className="w-full h-9 px-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-650 focus:outline-none focus:border-zinc-700 transition"
                    />
                    {errors.branch && (
                      <p className="text-[10px] text-rose-500 font-mono mt-0.5">{errors.branch.message}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold tracking-wider text-zinc-500 uppercase">
                      Deployment Type
                    </label>
                    <select
                      {...register('is_dockerized', { setValueAs: (v) => v === 'true' })}
                      className="w-full h-9 px-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-400 focus:outline-none focus:border-zinc-700 transition"
                    >
                      <option value="true">Docker Container</option>
                      <option value="false">Raw Shell Script</option>
                    </select>
                  </div>
                </div>

                {/* Deploy Script */}
                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold tracking-wider text-zinc-500 uppercase">
                    Deploy Script
                  </label>
                  <input
                    {...register('deploy_script')}
                    type="text"
                    placeholder="./deploy.sh  or  docker-compose up -d"
                    className="w-full h-9 px-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-650 focus:outline-none focus:border-zinc-700 transition"
                  />
                </div>

                {/* Form Buttons */}
                <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800 mt-6">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="h-9 px-4 rounded-lg text-xs font-mono border border-zinc-800 text-zinc-400 hover:text-zinc-250 hover:bg-zinc-900 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="h-9 px-4 rounded-lg text-xs font-mono font-bold bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-lg shadow-emerald-500/5 transition cursor-pointer"
                  >
                    {createMutation.isPending ? 'Registering...' : 'REGISTER PROJECT'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
export default Projects;
