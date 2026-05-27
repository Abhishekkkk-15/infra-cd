import React, { useState } from 'react';
import { 
  User, 
  Key, 
  Trash2, 
  Copy, 
  Sun, 
  Moon, 
  Sliders, 
  FileLock2 
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useNotification } from '../../hooks/useNotification';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api';

interface TokenItem {
  id: string;
  name: string;
  token: string;
  createdAt: string;
}

export const Settings: React.FC = () => {
  const { user } = useAuthStore();
  const notification = useNotification();
  
  // API tokens states
  const queryClient = useQueryClient();
  const { data: tokens = [] } = useQuery<TokenItem[]>({
    queryKey: ['personal-tokens'],
    queryFn: async () => {
      const { data } = await apiClient.get('/personal-tokens');
      // map backend names if necessary, assuming the backend returns an array of tokens
      return data.map((t: any) => ({
        id: t.id,
        name: t.name,
        token: 'icd_pat_••••••••••••', // only showing masked string for listing
        createdAt: t.created_at,
      }));
    }
  });
  const [newTokenName, setNewTokenName] = useState('');
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  // Deployment preferences states
  const [prefWebhooks, setPrefWebhooks] = useState(true);
  const [prefCache, setPrefCache] = useState(false);
  const [prefPrune, setPrefPrune] = useState(true);
  const [prefStrategy, setPrefStrategy] = useState('low-cpu');

  const createTokenMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data } = await apiClient.post('/personal-tokens', { name });
      return data;
    },
    onSuccess: (data) => {
      setGeneratedToken(data.token);
      setNewTokenName('');
      queryClient.invalidateQueries({ queryKey: ['personal-tokens'] });
      notification.success('Token Generated', 'New personal access token created.');
    },
    onError: () => {
      notification.error('Error', 'Failed to generate token');
    }
  });

  const deleteTokenMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/personal-tokens/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal-tokens'] });
      notification.warning('Token Revoked', 'The token was successfully invalidated.');
    },
    onError: () => {
      notification.error('Error', 'Failed to revoke token');
    }
  });

  const handleGenerateToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTokenName.trim()) return;
    createTokenMutation.mutate(newTokenName);
  };

  const handleDeleteToken = (id: string) => {
    deleteTokenMutation.mutate(id);
  };

  const handleCopyToken = () => {
    if (generatedToken) {
      navigator.clipboard.writeText(generatedToken);
      notification.success('Copied API Key', 'Key copied to clipboard safely.');
    }
  };

  return (
    <div className="space-y-6 font-sans select-none max-w-4xl">
      {/* Title Header */}
      <div className="border-b border-zinc-900 pb-5">
        <h1 className="text-xl font-bold tracking-tight text-zinc-100">Global Panel Settings</h1>
        <p className="text-xs text-zinc-500 font-mono mt-0.5">Configure authentication profiles, API keys, and deployment preferences</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        
        {/* Left Side: Profiles & System controls (Colspan 1) */}
        <div className="space-y-6">
          {/* User Profile Info */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h3 className="text-sm font-bold text-zinc-200 mb-4 border-b border-zinc-800/80 pb-2.5 flex items-center gap-1.5">
              <User className="w-4 h-4 text-zinc-400" /> Account Profile
            </h3>
            
            {user && (
              <div className="space-y-4 font-mono text-[10px] text-zinc-500">
                <div className="flex flex-col gap-1">
                  <span>NAME PROFILE</span>
                  <span className="text-zinc-200 text-xs font-bold font-sans">{user.name}</span>
                </div>
                
                <div className="flex flex-col gap-1 pt-1">
                  <span>EMAIL ADDRESS</span>
                  <span className="text-zinc-300 truncate">{user.email}</span>
                </div>

                <div className="flex flex-col gap-1 pt-1">
                  <span>PERMISSION LEVEL</span>
                  <span className="text-emerald-400 font-bold">{user.role}</span>
                </div>
              </div>
            )}
          </div>

          {/* Theme display switcher */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h3 className="text-sm font-bold text-zinc-200 mb-4 border-b border-zinc-800/80 pb-2.5 flex items-center gap-1.5">
              <Moon className="w-4 h-4 text-zinc-400" /> Panel Interface theme
            </h3>
            
            <div className="grid grid-cols-2 gap-2 p-1.5 bg-zinc-950 rounded-lg border border-zinc-850">
              <button
                disabled
                className="flex items-center justify-center gap-1.5 h-8 rounded text-[11px] font-mono text-zinc-650 cursor-not-allowed"
              >
                <Sun className="w-3.5 h-3.5" /> Light
              </button>
              <button
                className="flex items-center justify-center gap-1.5 h-8 rounded text-[11px] font-mono font-bold bg-zinc-900 border border-zinc-800 text-emerald-400"
              >
                <Moon className="w-3.5 h-3.5" /> Dark Mode
              </button>
            </div>
            <span className="text-[9px] font-mono text-zinc-600 block text-center mt-2.5">
              Dark mode locked by orchestrator rules
            </span>
          </div>
        </div>

        {/* Right Side: Web CLI tokens & settings (Colspan 2) */}
        <div className="md:col-span-2 space-y-6">
          
          {/* API Access Token generator */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-6">
            <div>
              <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-1.5">
                <Key className="w-4 h-4 text-zinc-400" /> Personal API Keys
              </h3>
              <p className="text-[11px] text-zinc-500 font-mono mt-0.5">Use keys to configure CLI tools and push notifications</p>
            </div>

            {/* Input field */}
            <form onSubmit={handleGenerateToken} className="p-3 bg-zinc-950 rounded-lg border border-zinc-850 flex gap-3 items-end">
              <div className="flex-1 space-y-1 font-mono text-[9px]">
                <span className="font-bold text-zinc-550">KEY LABEL NAME</span>
                <input 
                  type="text" 
                  value={newTokenName}
                  onChange={(e) => setNewTokenName(e.target.value)}
                  placeholder="Local development runner key"
                  className="w-full h-8 px-2.5 rounded bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="h-8 px-4 rounded bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-750 text-zinc-300 font-mono text-xs font-bold transition cursor-pointer"
              >
                Create Key
              </button>
            </form>

            {/* API Key generated preview banner */}
            {generatedToken && (
              <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-lg font-mono text-xs space-y-3">
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <FileLock2 className="w-4 h-4" /> Copy Secure API Token
                </div>
                <p className="text-zinc-400 text-[10px] leading-relaxed">
                  Make sure to copy this token now. It will not be shown again for security reasons.
                </p>
                <div className="p-2.5 bg-zinc-950 rounded border border-zinc-850 flex justify-between items-center text-[10px] text-zinc-200 break-all select-text font-bold">
                  <code>{generatedToken}</code>
                  <button 
                    onClick={handleCopyToken}
                    className="text-emerald-400 hover:underline flex items-center gap-1 shrink-0 ml-4 font-mono font-bold cursor-pointer"
                  >
                    <Copy className="w-3 h-3" /> copy
                  </button>
                </div>
              </div>
            )}

            {/* List of keys */}
            <div className="space-y-2">
              {tokens.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 bg-zinc-950/40 border border-zinc-850/60 rounded-lg font-mono text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-zinc-200">{t.name}</span>
                    <span className="text-[9px] text-zinc-550">Created {new Date(t.createdAt).toLocaleDateString()} // {t.token}</span>
                  </div>

                  <button
                    onClick={() => handleDeleteToken(t.id)}
                    className="p-1 rounded text-zinc-650 hover:text-red-400 hover:bg-red-500/5 transition cursor-pointer"
                    title="Revoke Token"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Deployment Preferences */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-5">
            <h3 className="text-sm font-bold text-zinc-200 border-b border-zinc-850 pb-2.5 flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-zinc-400" /> Build scheduling preferences
            </h3>

            <div className="space-y-4 font-sans text-xs">
              
              {/* Webhooks config toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5 pr-4">
                  <span className="font-bold text-zinc-200 block">Trigger webhooks builds</span>
                  <span className="text-[11px] text-zinc-500 font-mono">Process automated code push events from Git controllers</span>
                </div>
                <input 
                  type="checkbox"
                  checked={prefWebhooks}
                  onChange={(e) => setPrefWebhooks(e.target.checked)}
                  className="rounded bg-zinc-950 border-zinc-800 text-emerald-500 focus:ring-0 focus:ring-offset-0 h-4 w-4 cursor-pointer"
                />
              </div>

              {/* Cache builds config toggle */}
              <div className="flex items-center justify-between border-t border-zinc-850/50 pt-4">
                <div className="space-y-0.5 pr-4">
                  <span className="font-bold text-zinc-200 block">Prune build cache always</span>
                  <span className="text-[11px] text-zinc-500 font-mono">Disables layers caches, compiling files fresh every build run</span>
                </div>
                <input 
                  type="checkbox"
                  checked={prefCache}
                  onChange={(e) => setPrefCache(e.target.checked)}
                  className="rounded bg-zinc-950 border-zinc-800 text-emerald-500 focus:ring-0 focus:ring-offset-0 h-4 w-4 cursor-pointer"
                />
              </div>

              {/* Garbage collection daily pruning */}
              <div className="flex items-center justify-between border-t border-zinc-850/50 pt-4">
                <div className="space-y-0.5 pr-4">
                  <span className="font-bold text-zinc-200 block">Daily cluster pruning</span>
                  <span className="text-[11px] text-zinc-500 font-mono">Triggers Docker system prune on active online runner agents nightly</span>
                </div>
                <input 
                  type="checkbox"
                  checked={prefPrune}
                  onChange={(e) => setPrefPrune(e.target.checked)}
                  className="rounded bg-zinc-950 border-zinc-800 text-emerald-500 focus:ring-0 focus:ring-offset-0 h-4 w-4 cursor-pointer"
                />
              </div>

              {/* Runner allocation strategy */}
              <div className="flex flex-col gap-1.5 border-t border-zinc-850/50 pt-4">
                <span className="font-bold text-zinc-200 block">Runner VM scheduling strategy</span>
                <span className="text-[11px] text-zinc-500 font-mono pb-1">Algorithm to decide which agent node executes a build pipeline</span>
                <select
                  value={prefStrategy}
                  onChange={(e) => setPrefStrategy(e.target.value)}
                  className="w-full h-9 px-2 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-400 focus:outline-none focus:border-zinc-700 transition"
                >
                  <option value="low-cpu">Least Resource Usage (CPU first)</option>
                  <option value="round-robin">Round Robin Schedule</option>
                  <option value="affinity">Dedicated Affinity (Pin VM)</option>
                </select>
              </div>

            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
export default Settings;
