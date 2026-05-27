import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { Login } from './features/auth/Login';
import { CliAuth } from './features/auth/CliAuth';
import { Dashboard } from './features/dashboard/Dashboard';
import { Projects } from './features/projects/Projects';
import { ProjectDetails } from './features/projects/ProjectDetails';
import { DeploymentDetails } from './features/deployments/DeploymentDetails';
import { Agents } from './features/agents/Agents';
import { Settings } from './features/settings/Settings';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  useEffect(() => {
    // Ensure dark mode is active globally
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public login route */}
          <Route path="/login" element={<Login />} />
          <Route path="/cli-auth" element={<CliAuth />} />

          {/* Protected routes wrapped in the terminal dashboard layout */}
          <Route path="/" element={<DashboardLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetails />} />
            <Route path="deployments/:id" element={<DeploymentDetails />} />
            <Route path="agents" element={<Agents />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Catch-all redirect to dashboard index */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
