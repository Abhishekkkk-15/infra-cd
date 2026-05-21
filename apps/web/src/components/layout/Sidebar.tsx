import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  FolderGit2, 
  Cpu, 
  Settings as SettingsIcon, 
  ChevronLeft, 
  ChevronRight,
  Terminal as TerminalIcon,
  Search,
  LogOut
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useCommandPaletteStore } from '../../hooks/useCommandPalette';

export const Sidebar: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const togglePalette = useCommandPaletteStore((state) => state.toggle);

  // Read sidebar state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved) {
      setIsCollapsed(saved === 'true');
    }
  }, []);

  const handleToggle = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem('sidebar-collapsed', String(nextState));
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Projects', path: '/projects', icon: FolderGit2 },
    { name: 'Agents', path: '/agents', icon: Cpu },
    { name: 'Settings', path: '/settings', icon: SettingsIcon },
  ];

  return (
    <motion.aside
      initial={{ width: isCollapsed ? 64 : 240 }}
      animate={{ width: isCollapsed ? 64 : 240 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col h-screen bg-zinc-950 border-r border-zinc-800 text-zinc-400 select-none overflow-hidden shrink-0 z-20"
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-zinc-900 bg-zinc-950">
        <NavLink to="/" className="flex items-center gap-2 font-mono text-zinc-100 font-bold overflow-hidden whitespace-nowrap">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 shadow-md shadow-emerald-500/10">
            <TerminalIcon className="w-4 h-4 text-emerald-400 animate-pulse" />
          </div>
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="text-sm font-semibold tracking-tight bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent"
              >
                infra-cd
              </motion.span>
            )}
          </AnimatePresence>
        </NavLink>
        
        {!isCollapsed && (
          <div className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-900 border border-zinc-800 text-emerald-400">
            v1.0.0
          </div>
        )}
      </div>

      {/* Quick Search Shortcut */}
      <div className="p-2 border-b border-zinc-900 bg-zinc-950">
        <button
          onClick={togglePalette}
          className="flex items-center gap-2 w-full h-9 px-3 rounded-lg text-left text-xs font-medium text-zinc-500 hover:text-zinc-300 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition duration-150 cursor-pointer"
        >
          <Search className="w-3.5 h-3.5" />
          {!isCollapsed && (
            <div className="flex items-center justify-between w-full">
              <span>Quick search...</span>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 h-5 select-none rounded border border-zinc-800 bg-zinc-950 px-1.5 font-mono text-[9px] font-medium text-zinc-500 shadow-sm">
                <span>⌘</span>K
              </kbd>
            </div>
          )}
        </button>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = item.path === '/' 
            ? location.pathname === '/' 
            : location.pathname.startsWith(item.path);
            
          return (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) => `
                flex items-center gap-3 h-10 px-3 rounded-lg text-sm font-medium transition duration-150 relative cursor-pointer
                ${isActive 
                  ? 'text-zinc-100 bg-zinc-900/60 border border-zinc-800/40 shadow-inner' 
                  : 'hover:text-zinc-200 hover:bg-zinc-900/30'
                }
              `}
            >
              <item.icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-emerald-400' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="whitespace-nowrap"
                >
                  {item.name}
                </motion.span>
              )}
              {isActive && (
                <motion.div
                  layoutId="sidebar-active-indicator"
                  className="absolute left-0 w-1 h-5 rounded-r bg-emerald-400"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer / User Profile */}
      <div className="p-2 border-t border-zinc-900 bg-zinc-950 mt-auto">
        {user && (
          <div className="flex items-center gap-3 p-2 rounded-lg bg-zinc-900/30 border border-zinc-900">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 shrink-0 font-semibold font-mono text-sm shadow-inner">
              {user.name.charAt(0)}
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-semibold text-zinc-200 truncate leading-none">
                  {user.name}
                </span>
                <span className="text-[10px] text-zinc-500 truncate mt-1">
                  {user.role}
                </span>
              </div>
            )}
            {!isCollapsed && (
              <button
                onClick={logout}
                title="Log Out"
                className="p-1 rounded hover:bg-zinc-800 hover:text-red-400 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Sidebar Toggle Button */}
        <button
          onClick={handleToggle}
          className="flex items-center justify-center w-full h-8 mt-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/60 border border-transparent hover:border-zinc-800 transition duration-150 cursor-pointer"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </motion.aside>
  );
};
export default Sidebar;
