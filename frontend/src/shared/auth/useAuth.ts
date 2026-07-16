import { useAuthStore } from './auth.store';
import type { Role } from '@sheben/shared';

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = Boolean(user && useAuthStore.getState().accessToken);
  return {
    user,
    isAuthenticated,
    hasRole: (...roles: Role[]) => (user ? roles.includes(user.role) : false),
    isOwnerOrAdmin: user ? user.role === 'OWNER' || user.role === 'ADMIN' : false,
  };
}
