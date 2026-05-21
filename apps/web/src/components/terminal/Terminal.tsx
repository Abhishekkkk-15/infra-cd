import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { Clipboard, Trash2, ArrowDownCircle, AlertCircle } from 'lucide-react';
import { useNotification } from '../../hooks/useNotification';
import 'xterm/css/xterm.css';

interface TerminalProps {
  logs?: string[];
  onTerminalReady?: (terminal: XTerm) => void;
  onClear?: () => void;
}

export const Terminal: React.FC<TerminalProps> = ({ logs = [], onTerminalReady, onClear }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lastWrittenIndex = useRef(0);
  const [autoScroll, setAutoScroll] = useState(true);
  const notification = useNotification();

  // Initialize XTerm Instance
  useEffect(() => {
    if (!containerRef.current) return;

    // Configure theme to match Zinc terminal palette
    const term = new XTerm({
      cursorBlink: true,
      cursorStyle: 'underline',
      theme: {
        background: '#09090b', // Zinc-950
        foreground: '#e4e4e7', // Zinc-200
        cursor: '#10b981',     // Emerald-500
        selectionBackground: 'rgba(255, 255, 255, 0.15)',
        black: '#18181b',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#d946ef',
        cyan: '#06b6d4',
        white: '#f4f4f5',
        brightBlack: '#71717a',
        brightRed: '#f87171',
        brightGreen: '#34d399',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',
        brightMagenta: '#f472b6',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff',
      },
      fontSize: 12,
      fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, Courier New, monospace',
      rows: 24,
      scrollback: 10000,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    if (onTerminalReady) {
      onTerminalReady(term);
    }

    // Write initial logs
    logs.forEach((line) => {
      term.write(line + '\r\n');
    });
    lastWrittenIndex.current = logs.length;

    // Handle Resize Observer
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch {
        // ignore resizing glitch on hidden tab mounts
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      term.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      lastWrittenIndex.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Write new log updates incrementally
  useEffect(() => {
    const term = terminalRef.current;
    if (!term) return;

    // If logs were cleared/reset
    if (logs.length === 0) {
      term.clear();
      lastWrittenIndex.current = 0;
      return;
    }

    // Write only incremental differences
    if (logs.length > lastWrittenIndex.current) {
      const pendingLogs = logs.slice(lastWrittenIndex.current);
      pendingLogs.forEach((line) => {
        term.write(line + '\r\n');
      });
      lastWrittenIndex.current = logs.length;

      if (autoScroll) {
        term.scrollToBottom();
      }
    }
  }, [logs, autoScroll]);

  // Copy Logs Handler
  const handleCopyLogs = () => {
    if (logs.length === 0) {
      notification.warning('No logs available', 'Terminal output buffer is empty.');
      return;
    }
    // eslint-disable-next-line no-control-regex
    const cleanLogs = logs.map(line => line.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')).join('\n');
    navigator.clipboard.writeText(cleanLogs);
    notification.success('Copied to clipboard', 'Terminal build logs copied successfully.');
  };

  const handleClear = () => {
    if (onClear) {
      onClear();
    } else {
      terminalRef.current?.clear();
      lastWrittenIndex.current = 0;
    }
    notification.info('Logs Cleared', 'Terminal screen flushed.');
  };

  return (
    <div className="flex flex-col bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden w-full select-text shadow-xl">
      {/* Terminal Header Tab */}
      <div className="flex items-center justify-between h-9 px-4 bg-zinc-900 border-b border-zinc-800 select-none">
        <div className="flex items-center gap-2">
          {/* OS Dot controls mock */}
          <div className="flex gap-1.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/80"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-green-500/80"></span>
          </div>
          <span className="text-[11px] font-mono font-semibold text-zinc-400 pl-1.5">
            stdout - deployment.log
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition cursor-pointer ${
              autoScroll
                ? 'text-emerald-400 hover:text-emerald-300 hover:bg-zinc-800 bg-emerald-500/5 border border-emerald-500/10'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 border border-transparent'
            }`}
            title="Auto-scroll logs"
          >
            <ArrowDownCircle className="w-3 h-3" />
            <span>auto-scroll</span>
          </button>

          <div className="w-px h-3.5 bg-zinc-800 mx-1 shrink-0"></div>

          <button
            onClick={handleCopyLogs}
            className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition cursor-pointer"
            title="Copy logs to clipboard"
          >
            <Clipboard className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleClear}
            className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition cursor-pointer"
            title="Clear screen buffer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal View Container */}
      <div className="flex-1 p-3 min-h-[320px] bg-zinc-950 font-mono relative">
        <div ref={containerRef} className="w-full h-full relative" />
        
        {logs.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600 gap-2 select-none">
            <AlertCircle className="w-5 h-5 opacity-40 text-zinc-500" />
            <span className="text-xs font-mono">No build or stream output recorded</span>
          </div>
        )}
      </div>
    </div>
  );
};
export default Terminal;
