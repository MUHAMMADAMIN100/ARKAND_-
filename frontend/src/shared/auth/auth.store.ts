import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser } from '@sheben/shared';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (data: { user: AuthUser; accessToken: string; refreshToken: string }) => void;
  setTokens: (tokens: { accessToken: string; refreshToken: string }) => void;
  clear: () => void;
}

/** Auth-хранилище. Токены в localStorage (раздельные домены Vercel↔Railway, cookie кросс-домен не подходит). */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setSession: (data) =>
        set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken }),
      setTokens: (tokens) => set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }),
      clear: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    { name: 'sheben-auth' },
  ),
);

/** Не-реактивный доступ к состоянию (для http-клиента вне React). */
export const authStore = {
  get: () => useAuthStore.getState(),
};
