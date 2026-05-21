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

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: async (email, password) => {
        // Simulate API network latency
        await new Promise((resolve) => setTimeout(resolve, 800));

        if (!password || password.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }

        // Create a mock JWT token and user profile
        const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkRldmVsb3BlciIsImVtYWlsIjoiZGV2QGluZnJhLWNkLmRldiIsInJvbGUiOiJhZG1pbiJ9.mock_signature';
        const user: User = {
          id: 'dev-user-id',
          email,
          name: email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1),
          role: 'Admin',
          token: mockToken,
        };

        set({ user, token: mockToken, isAuthenticated: true });
        return user;
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
