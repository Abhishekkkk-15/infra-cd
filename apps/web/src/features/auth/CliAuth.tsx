import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Terminal, ShieldCheck, CheckCircle, XCircle } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { apiClient } from '../../api';

export const CliAuth: React.FC = () => {
  const [searchParams] = useSearchParams();
  const port = searchParams.get('port');
  const { isAuthenticated } = useAuthStore();
  const [status, setStatus] = useState<'idle' | 'authorizing' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  if (!port) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-100 font-mono">
        <div className="text-center">
          <XCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl">Invalid Request</h2>
          <p className="text-zinc-500 mt-2">Missing callback port parameter.</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-100 font-mono">
        <div className="text-center space-y-4">
          <Terminal className="w-12 h-12 text-emerald-500 mx-auto" />
          <h2 className="text-xl">Authentication Required</h2>
          <p className="text-zinc-500">You must be logged in to authorize the CLI.</p>
          <a href="/login" className="inline-block mt-4 px-4 py-2 bg-emerald-500 text-zinc-950 rounded font-bold hover:bg-emerald-400">
            Log In First
          </a>
        </div>
      </div>
    );
  }

  const handleAuthorize = async () => {
    setStatus('authorizing');
    try {
      // Create a PAT for the CLI
      const response = await apiClient.post('/personal-tokens', {
        name: `CLI Session - ${new Date().toLocaleString()}`
      });
      const token = response.data.token;
      
      setStatus('success');
      // Redirect back to CLI local server
      window.location.href = `http://127.0.0.1:${port}/callback?token=${token}`;
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err.response?.data?.error || 'Failed to generate token');
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-100 font-sans">
      <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-8 rounded-xl text-center shadow-2xl">
        <div className="w-16 h-16 bg-zinc-950 border border-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
          <ShieldCheck className="w-8 h-8 text-emerald-400" />
        </div>
        
        <h2 className="text-2xl font-bold tracking-tight mb-2">Authorize CLI</h2>
        <p className="text-sm text-zinc-400 mb-8">
          The infra-cd CLI is requesting access to your account. This will generate a Personal Access Token for the CLI to use.
        </p>

        {status === 'error' && (
          <div className="mb-6 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded">
            {errorMsg}
          </div>
        )}

        {status === 'success' ? (
          <div className="flex flex-col items-center">
            <CheckCircle className="w-12 h-12 text-emerald-500 mb-4 animate-bounce" />
            <p className="text-emerald-400 font-medium">Authorization successful!</p>
            <p className="text-zinc-500 text-sm mt-2">You can close this window and return to your terminal.</p>
          </div>
        ) : (
          <button
            onClick={handleAuthorize}
            disabled={status === 'authorizing'}
            className="w-full h-12 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-mono font-bold rounded-lg disabled:opacity-50 transition"
          >
            {status === 'authorizing' ? 'AUTHORIZING...' : 'AUTHORIZE'}
          </button>
        )}
      </div>
    </div>
  );
};
