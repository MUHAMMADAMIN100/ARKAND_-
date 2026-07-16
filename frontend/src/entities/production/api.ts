import { http } from '../../shared/api/http';
import type {
  CloseShiftInput,
  OpenShiftInput,
  Paginated,
  ProductionShiftDto,
  RecordOutputInput,
} from '@sheben/shared';

export const productionKeys = {
  all: ['production', 'shifts'] as const,
  list: (params: Record<string, unknown>) => ['production', 'shifts', 'list', params] as const,
  detail: (id: string) => ['production', 'shifts', 'detail', id] as const,
};

export type ShiftListParams = {
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}

export function fetchShifts(params: ShiftListParams): Promise<Paginated<ProductionShiftDto>> {
  return http.get<Paginated<ProductionShiftDto>>('/production/shifts', {
    query: params as Record<string, string | number | undefined>,
  });
}

export function fetchShift(id: string): Promise<ProductionShiftDto> {
  return http.get<ProductionShiftDto>(`/production/shifts/${id}`);
}

export function openShift(input: OpenShiftInput): Promise<ProductionShiftDto> {
  return http.post<ProductionShiftDto>('/production/shifts', input);
}

export function recordOutput(id: string, input: RecordOutputInput): Promise<ProductionShiftDto> {
  return http.post<ProductionShiftDto>(`/production/shifts/${id}/output`, input);
}

export function closeShift(id: string, input: CloseShiftInput): Promise<ProductionShiftDto> {
  return http.post<ProductionShiftDto>(`/production/shifts/${id}/close`, input);
}
