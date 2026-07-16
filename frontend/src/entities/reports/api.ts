import { http } from '../../shared/api/http';
import type { FinanceReport, ProductionReportRow, ReportPeriod, ResourcesReport } from '@sheben/shared';

export const reportsKeys = {
  production: (period: ReportPeriod) => ['reports', 'production', period] as const,
  resources: (period: ReportPeriod) => ['reports', 'resources', period] as const,
  finance: (period: ReportPeriod) => ['reports', 'finance', period] as const,
};

export function fetchProductionReport(period: ReportPeriod): Promise<ProductionReportRow[]> {
  return http.get<ProductionReportRow[]>('/reports/production', { query: period });
}

export function fetchResourcesReport(period: ReportPeriod): Promise<ResourcesReport> {
  return http.get<ResourcesReport>('/reports/resources', { query: period });
}

export function fetchFinanceReport(period: ReportPeriod): Promise<FinanceReport> {
  return http.get<FinanceReport>('/reports/finance', { query: period });
}
