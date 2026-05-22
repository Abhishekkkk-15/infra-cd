import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, ShieldCheck, Mail, Lock, Server, Cpu, Database, User } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useNotification } from '../../hooks/useNotification';

// Zod schemas
const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFields = z.infer<typeof loginSchema>;
type SignupFields = z.infer<typeof signupSchema>;

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, register: registerUser, isAuthenticated } = useAuthStore();
  const notification = useNotification();
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SignupFields>({
    resolver: zodResolver(isSignUp ? signupSchema : loginSchema),
    defaultValues: {
      name: '',
      email: 'admin@infra-cd.dev',
      password: 'admin-password',
    }
  });

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    reset({ name: '', email: '', password: '' });
  };

  const onSubmit = async (data: SignupFields) => {
    setIsLoading(true);
    try {
      if (isSignUp) {
        await registerUser(data.name, data.email, data.password);
        notification.success('Account created', `Welcome, ${data.name}!`);
      } else {
        await login(data.email, data.password);
        notification.success('Authentication successful', `Welcome to the console.`);
      }
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Check your credentials.';
      notification.error(isSignUp ? 'Registration failed' : 'Authentication failed', message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans select-none">
      
      {/* LEFT SIDE: Platform Graphics & Status stdout */}
      <div className="hidden lg:flex lg:w-1/2 bg-zinc-950 relative border-r border-zinc-900 flex-col justify-between p-12 overflow-hidden">
        {/* Animated Background Mesh */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.06),transparent_50%)]"></div>
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-indigo-500/5 filter blur-3xl shrink-0"></div>

        {/* Branding header */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 shadow-lg shadow-emerald-500/5">
            <Terminal className="w-5 h-5 text-emerald-400" />
          </div>
          <span className="font-mono text-lg font-bold tracking-tight text-zinc-100">
            infra-cd
          </span>
        </div>

        {/* Main Info graphics */}
        <div className="my-auto relative z-10 max-w-md space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-zinc-100 via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
              Decentralized CI/CD Orchestrator
            </h1>
            <p className="text-sm text-zinc-400 mt-3 leading-relaxed">
              Self-host Docker containers and shell scripts. Monitor builds and cluster runner health via a high-performance console.
            </p>
          </motion.div>

          {/* Running Platform Metrics list */}
          <div className="space-y-2 border border-zinc-900 bg-zinc-950/60 backdrop-blur rounded-xl p-4 font-mono text-[11px] text-zinc-500">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-900">
              <span className="text-zinc-400 font-semibold">Consul Status Indicators</span>
              <span className="text-emerald-400 flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                Active
              </span>
            </div>
            <div className="flex items-center gap-2 pt-1.5">
              <Server className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
              <span>Gateway proxy nodes: </span>
              <span className="text-zinc-300 ml-auto">12/12 online</span>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Cpu className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
              <span>Runner core agents: </span>
              <span className="text-zinc-300 ml-auto">3 connected</span>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Database className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
              <span>Pipeline storage replication: </span>
              <span className="text-emerald-400 ml-auto">Healthy (9ms)</span>
            </div>
          </div>
        </div>

        {/* Footer legalities */}
        <div className="relative z-10 font-mono text-[10px] text-zinc-600">
          <span>SECURE CORE CONTEXT // TLS 1.3 SIGNED // INFRA-CD ORG</span>
        </div>
      </div>

      {/* RIGHT SIDE: Authentication Card */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-zinc-950 relative overflow-y-auto">
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-80 h-80 bg-emerald-500/5 rounded-full filter blur-3xl shrink-0"></div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-sm bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-xl p-8 rounded-2xl shadow-2xl flex flex-col relative z-10 my-auto"
        >
          {/* Header */}
          <div className="flex flex-col items-center text-center">
            <div className="w-11 h-11 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400 shadow-inner">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-100 mt-4">
              {isSignUp ? 'Create Account' : 'Access Console'}
            </h2>
            <p className="text-xs text-zinc-500 mt-1">
              {isSignUp ? 'Join the platform to start building.' : 'Enter your administration details below'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
            <AnimatePresence initial={false}>
              {isSignUp && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-1.5 overflow-hidden"
                >
                  <label className="text-[11px] font-mono font-bold tracking-wider text-zinc-500 uppercase">
                    Full Name
                  </label>
                  <div className="relative flex items-center">
                    <User className="w-4 h-4 text-zinc-600 absolute left-3 pointer-events-none" />
                    <input
                      {...register('name')}
                      type="text"
                      placeholder="Jane Doe"
                      className="w-full h-10 pl-9 pr-4 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-800 transition"
                      disabled={isLoading}
                    />
                  </div>
                  {errors.name && (
                    <p className="text-[10px] text-rose-500 font-mono mt-1">{errors.name.message}</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono font-bold tracking-wider text-zinc-500 uppercase">
                Email address
              </label>
              <div className="relative flex items-center">
                <Mail className="w-4 h-4 text-zinc-600 absolute left-3 pointer-events-none" />
                <input
                  {...register('email')}
                  type="email"
                  placeholder="admin@infra-cd.dev"
                  className="w-full h-10 pl-9 pr-4 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-800 transition"
                  disabled={isLoading}
                />
              </div>
              {errors.email && (
                <p className="text-[10px] text-rose-500 font-mono mt-1">{errors.email.message}</p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-mono font-bold tracking-wider text-zinc-500 uppercase">
                  Password
                </label>
                {!isSignUp && (
                  <a href="#reset" className="text-[10px] font-mono text-zinc-500 hover:text-zinc-300 transition">
                    Forgot?
                  </a>
                )}
              </div>
              <div className="relative flex items-center">
                <Lock className="w-4 h-4 text-zinc-600 absolute left-3 pointer-events-none" />
                <input
                  {...register('password')}
                  type="password"
                  placeholder="••••••••••••"
                  className="w-full h-10 pl-9 pr-4 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-800 transition"
                  disabled={isLoading}
                />
              </div>
              {errors.password && (
                <p className="text-[10px] text-rose-500 font-mono mt-1">{errors.password.message}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`
                w-full h-10 mt-6 rounded-lg text-xs font-mono font-bold tracking-wide transition shadow-lg cursor-pointer
                ${isLoading 
                  ? 'bg-zinc-800 text-zinc-500 border border-zinc-700/50 cursor-not-allowed'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 border border-emerald-400 hover:shadow-emerald-500/10'
                }
              `}
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-zinc-500 border-t-zinc-300 rounded-full animate-spin"></div>
                  <span>{isSignUp ? 'Registering...' : 'Authenticating...'}</span>
                </div>
              ) : (
                isSignUp ? 'CREATE ACCOUNT' : 'VALIDATE SECURE SIGN-IN'
              )}
            </button>
          </form>

          {/* Toggle mode */}
          <div className="mt-6 text-center text-[11px] text-zinc-400 font-sans">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              type="button"
              onClick={toggleMode}
              className="text-emerald-400 hover:text-emerald-300 hover:underline transition font-bold"
            >
              {isSignUp ? "Sign In" : "Sign Up"}
            </button>
          </div>

        </motion.div>
      </div>
    </div>
  );
};
export default Login;
