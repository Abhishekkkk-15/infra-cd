import React, { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuthStore } from '../../store/authStore';
import { CommandPalette } from '../palette/CommandPalette';
import { Toaster } from 'sonner';

export const DashboardLayout: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    // If not authenticated, redirect to /login
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen w-screen bg-zinc-950 items-center justify-center font-mono text-zinc-500 text-xs">
        Redirecting to auth endpoint...
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans antialiased">
      {/* Sidebar navigation */}
      <Sidebar />

      {/* Main workspace container */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        <Header />
        
        {/* Dynamic page contents scrollable area */}
        <main className="flex-1 overflow-y-auto bg-zinc-950 p-6">
          <Outlet />
        </main>
      </div>

      {/* Cmd+K Search Command Palette overlay */}
      <CommandPalette />

      {/* sonner notifications provider */}
      <Toaster 
        position="top-right" 
        theme="dark" 
        expand={false} 
        richColors 
        closeButton
      />
    </div>
  );
};
export default DashboardLayout;
