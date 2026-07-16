import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { FiLock } from 'react-icons/fi';
import type { Role } from '@sheben/shared';
import { useAuthStore } from '../../shared/auth/auth.store';
import { EmptyState } from '../../shared/ui/feedback/States';

export function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const location = useLocation();
  const { user, accessToken } = useAuthStore();

  if (!user || !accessToken) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return (
      <EmptyState icon={<FiLock />} title="Нет доступа" hint="У вашей роли нет прав на этот раздел." />
    );
  }
  return <>{children}</>;
}
