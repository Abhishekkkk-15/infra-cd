import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
}

import axios from 'axios';

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

        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';
        
        try {
          const res = await axios.post(`${API_URL}/auth/login`, {
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
      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
      },
    }),
    {
      name: 'infra-cd-auth',
    }
  )
);
