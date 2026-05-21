import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  FolderGit2, 
  Cpu, 
  Settings, 
  LogOut, 
  Play, 
  Plus, 
  Sparkles 
} from 'lucide-react';
import { useCommandPaletteStore } from '../../hooks/useCommandPalette';
import { useAuthStore } from '../../store/authStore';
import { useProjectStore } from '../../store/projectStore';
import { useNotification } from '../../hooks/useNotification';

interface CommandItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  category: 'Navigation' | 'Actions' | 'Projects';
  shortcut?: string[];
  action: () => void;
}

export const CommandPalette: React.FC = () => {
  const navigate = useNavigate();
  const { isOpen, setOpen } = useCommandPaletteStore();
  const { logout } = useAuthStore();
  const { projects, triggerDeployment } = useProjectStore();
  const notification = useNotification();

  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, setOpen]);

  const baseCommands: CommandItem[] = [
    {
      category: 'Navigation',
      label: 'Go to Dashboard',
      icon: Sparkles,
      shortcut: ['G', 'D'],
      action: () => { navigate('/'); setOpen(false); }
    },
    {
      category: 'Navigation',
      label: 'Go to Projects',
      icon: FolderGit2,
      shortcut: ['G', 'P'],
      action: () => { navigate('/projects'); setOpen(false); }
    },
    {
      category: 'Navigation',
      label: 'Go to Agents',
      icon: Cpu,
      shortcut: ['G', 'A'],
      action: () => { navigate('/agents'); setOpen(false); }
    },
    {
      category: 'Navigation',
      label: 'Go to Settings',
      icon: Settings,
      shortcut: ['G', 'S'],
      action: () => { navigate('/settings'); setOpen(false); }
    },
    {
      category: 'Actions',
      label: 'Create New Project',
      icon: Plus,
      shortcut: ['N'],
      action: () => { navigate('/projects'); setOpen(false); notification.info('Create Project', 'Use the "New Project" button in the projects page.'); }
    },
    {
      category: 'Actions',
      label: 'Log Out Session',
      icon: LogOut,
      action: () => { logout(); setOpen(false); notification.success('Logged Out', 'Your session has been terminated.'); }
    }
  ];

  // Append project builds to commands
  const projectCommands: CommandItem[] = projects.map((p) => ({
    category: 'Projects',
    label: `Trigger deployment: ${p.name}`,
    icon: Play,
    action: () => {
      triggerDeployment(p.id, 'manual');
      notification.success('Deployment Triggered', `Manual deployment initiated for ${p.name}`);
      setOpen(false);
      navigate(`/projects/${p.id}`);
    }
  }));

  const allCommands = [...baseCommands, ...projectCommands];

  const filteredCommands = allCommands.filter((cmd) =>
    cmd.label.toLowerCase().includes(search.toLowerCase()) ||
    cmd.category.toLowerCase().includes(search.toLowerCase())
  );

  // Handle Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Dialog Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            ref={containerRef}
            className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-10 flex flex-col font-sans"
          >
            {/* Input search bar */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
              <Search className="w-4 h-4 text-zinc-500 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search commands, pages, and active projects..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelectedIndex(0);
                }}
                className="w-full bg-transparent border-0 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-0"
              />
              <span className="text-[10px] font-mono bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 text-zinc-500 select-none">
                ESC
              </span>
            </div>

            {/* Suggestions list */}
            <div className="max-h-[340px] overflow-y-auto p-2 space-y-1">
              {filteredCommands.length === 0 ? (
                <div className="p-4 text-center text-xs text-zinc-500 font-mono">
                  No commands matching "{search}"
                </div>
              ) : (
                // Grouping commands by category
                ['Navigation', 'Actions', 'Projects'].map((cat) => {
                  const itemsInCat = filteredCommands.filter((c) => c.category === cat);
                  if (itemsInCat.length === 0) return null;

                  return (
                    <div key={cat} className="space-y-0.5">
                      <div className="px-3 py-1.5 text-[9px] font-mono font-bold tracking-wider text-zinc-600 uppercase select-none">
                        {cat}
                      </div>
                      {itemsInCat.map((cmd) => {
                        const globalIndex = filteredCommands.indexOf(cmd);
                        const isSelected = globalIndex === selectedIndex;

                        return (
                          <button
                            key={cmd.label}
                            onClick={cmd.action}
                            onMouseEnter={() => setSelectedIndex(globalIndex)}
                            className={`
                              flex items-center justify-between w-full h-10 px-3 rounded-lg text-left text-xs transition-colors duration-75 cursor-pointer
                              ${isSelected 
                                ? 'bg-zinc-800 text-zinc-100' 
                                : 'text-zinc-400 hover:bg-zinc-800/40'
                              }
                            `}
                          >
                            <div className="flex items-center gap-3">
                              <cmd.icon className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-400' : 'text-zinc-500'}`} />
                              <span>{cmd.label}</span>
                            </div>
                            {cmd.shortcut && (
                              <div className="flex items-center gap-0.5 select-none">
                                {cmd.shortcut.map((s) => (
                                  <kbd 
                                    key={s} 
                                    className="px-1 py-0.5 rounded font-mono text-[9px] bg-zinc-950 border border-zinc-800 text-zinc-500"
                                  >
                                    {s}
                                  </kbd>
                                ))}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>
            
            {/* Command Palette Footnotes */}
            <div className="px-4 py-2 border-t border-zinc-800/60 bg-zinc-950/40 text-[10px] text-zinc-500 flex items-center justify-between select-none">
              <span className="font-mono">Use ↑↓ keys to navigate, ↵ to run</span>
              <span className="font-mono font-bold">infra-cd console</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
export default CommandPalette;
