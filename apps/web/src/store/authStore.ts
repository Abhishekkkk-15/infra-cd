import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';
import { apiClient } from '@/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => void;
}


export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: async (email, password) => {
        if (!password || password.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }

        
        try {
          const res = await apiClient.post(`/auth/login`, {
            email,
            password
          });
          
          const { token, user } = res.data;
          
          set({ user, token, isAuthenticated: true });
          return user;
        } catch (err: any) {
          if (err.response?.data?.error) {
            throw new Error(err.response.data.error);
          }
          throw new Error('Authentication failed');
        }
      },
      register: async (name, email, password) => {
        if (!password || password.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }

        
        try {
          const res = await apiClient.post(`/auth/register`, {
            name,
            email,
            password
          });
          
          const { token, user } = res.data;
          
          set({ user, token, isAuthenticated: true });
          return user;
        } catch (err: any) {
          if (err.response?.data?.error) {
            throw new Error(err.response.data.error);
          }
          throw new Error('Registration failed');
        }
      },
      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
      },
    }),
    {
      name: 'infra-cd-auth',
    }
  )
);
