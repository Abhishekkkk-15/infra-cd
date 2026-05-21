import { toast } from 'sonner';

export const useNotification = () => {
  const showSuccess = (message: string, description?: string) => {
    toast.success(message, {
      description,
      className: 'bg-zinc-950 border border-emerald-500/20 text-zinc-100 font-sans shadow-lg shadow-emerald-500/5',
      descriptionClassName: 'text-zinc-400 font-normal text-xs',
    });
  };

  const showError = (message: string, description?: string) => {
    toast.error(message, {
      description,
      className: 'bg-zinc-950 border border-red-500/20 text-zinc-100 font-sans shadow-lg shadow-red-500/5',
      descriptionClassName: 'text-zinc-400 font-normal text-xs',
    });
  };

  const showInfo = (message: string, description?: string) => {
    toast.info(message, {
      description,
      className: 'bg-zinc-950 border border-blue-500/20 text-zinc-100 font-sans shadow-lg shadow-blue-500/5',
      descriptionClassName: 'text-zinc-400 font-normal text-xs',
    });
  };

  const showWarning = (message: string, description?: string) => {
    toast.warning(message, {
      description,
      className: 'bg-zinc-950 border border-amber-500/20 text-zinc-100 font-sans shadow-lg shadow-amber-500/5',
      descriptionClassName: 'text-zinc-400 font-normal text-xs',
    });
  };

  return {
    success: showSuccess,
    error: showError,
    info: showInfo,
    warning: showWarning,
  };
};
