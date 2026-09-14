import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types';
import { isTokenValid } from '../utils/token';

interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (user: User) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: (user, token) => {
        try {
          localStorage.setItem('support_token', token);
          localStorage.setItem('support_user', JSON.stringify(user));
        } catch (e) {
          console.error('Failed to save auth to localStorage:', e);
        }
        set({ user, token, isAuthenticated: true });
      },

      logout: () => {
        try {
          localStorage.removeItem('support_token');
          localStorage.removeItem('support_user');
          localStorage.removeItem('supportai-auth');
        } catch (e) {
          console.error('Failed to clear auth from localStorage:', e);
        }
        set({ user: null, token: null, isAuthenticated: false });
      },

      updateUser: (user) => set({ user }),
    }),
    {
      name: 'supportai-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && (!isTokenValid(state.token) || !state.token)) {
          state.logout();
        }
      },
    }
  )
);
