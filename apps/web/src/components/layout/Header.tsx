import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Bell, RefreshCw } from 'lucide-react';
import { useWebSocket } from '../../hooks/useWebSocket';

export const Header: React.FC = () => {
  const location = useLocation();
  const { isConnected } = useWebSocket();

  // Generate breadcrumbs from pathname
  const pathnames = location.pathname.split('/').filter((x) => x);

  const getBreadcrumbs = () => {
    return (
      <div className="flex items-center gap-1.5 font-mono text-xs text-zinc-500">
        <Link to="/" className="hover:text-zinc-300 transition-colors">
          root
        </Link>
        {pathnames.map((value, index) => {
          const to = `/${pathnames.slice(0, index + 1).join('/')}`;
          const isLast = index === pathnames.length - 1;
          
          // Prettify name
          let name = value;
          if (value.startsWith('proj-')) name = 'project';
          if (value.startsWith('dep-')) name = 'deployment';

          return (
            <React.Fragment key={to}>
              <ChevronRight className="w-3 h-3 text-zinc-600 shrink-0" />
              {isLast ? (
                <span className="text-zinc-200 truncate max-w-[140px] font-semibold">{name}</span>
              ) : (
                <Link to={to} className="hover:text-zinc-300 transition-colors truncate max-w-[120px]">
                  {name}
                </Link>
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  return (
    <header className="flex items-center justify-between h-14 px-6 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-10 select-none">
      {/* Left breadcrumb nav */}
      <div className="flex items-center gap-2 overflow-hidden mr-4">
        {getBreadcrumbs()}
      </div>

      {/* Right control utilities */}
      <div className="flex items-center gap-4 shrink-0">
        {/* System connection state */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] font-mono select-none">
          <span className="relative flex h-1.5 w-1.5">
            {isConnected ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </>
            ) : (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
              </>
            )}
          </span>
          <span className={isConnected ? 'text-emerald-400' : 'text-amber-400'}>
            {isConnected ? 'connected' : 'standby'}
          </span>
        </div>

        {/* Notifications and Sync widgets */}
        <div className="flex items-center gap-1.5">
          <button 
            title="Refresh statistics"
            onClick={() => window.location.reload()}
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 transition duration-150 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          
          <button 
            title="System alerts"
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 transition duration-150 relative cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 flex h-1.5 w-1.5 rounded-full bg-indigo-500"></span>
          </button>
        </div>
      </div>
    </header>
  );
};
export default Header;
