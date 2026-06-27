import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AdminUser {
  id: string;
  email: string;
  full_name?: string;
}

interface AdminState {
  token: string | null;
  refreshToken: string | null;
  admin: AdminUser | null;
  setAuth: (token: string, refreshToken: string, admin: AdminUser) => void;
  setTokens: (token: string, refreshToken: string) => void;
  logout: () => void;
}

export const useAdminStore = create<AdminState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      admin: null,
      setAuth: (token, refreshToken, admin) => set({ token, refreshToken, admin }),
      setTokens: (token, refreshToken) => set({ token, refreshToken }),
      logout: () => set({ token: null, refreshToken: null, admin: null }),
    }),
    {
      name: 'admin-storage',
    }
  )
);
