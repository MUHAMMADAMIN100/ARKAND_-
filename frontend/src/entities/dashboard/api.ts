import { http } from '../../shared/api/http';
import type { DashboardSummary } from '@sheben/shared';

export const dashboardKeys = {
  summary: ['dashboard', 'summary'] as const,
};

export function fetchDashboard(): Promise<DashboardSummary> {
  return http.get<DashboardSummary>('/reports/dashboard');
}
