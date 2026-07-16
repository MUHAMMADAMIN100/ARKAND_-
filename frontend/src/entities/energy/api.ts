import { http } from '../../shared/api/http';
import type { CreateElectricityLogInput, ElectricityLogDto, UpdateElectricityLogInput } from '@sheben/shared';

export const energyKeys = {
  all: ['energy'] as const,
  list: () => ['energy', 'list'] as const,
};

export function fetchElectricityLogs(): Promise<ElectricityLogDto[]> {
  return http.get<ElectricityLogDto[]>('/energy');
}

export function createElectricityLog(input: CreateElectricityLogInput): Promise<ElectricityLogDto> {
  return http.post<ElectricityLogDto>('/energy', input);
}

export function updateElectricityLog(id: string, input: UpdateElectricityLogInput): Promise<ElectricityLogDto> {
  return http.patch<ElectricityLogDto>(`/energy/${id}`, input);
}

export function deleteElectricityLog(id: string): Promise<{ ok: true }> {
  return http.delete<{ ok: true }>(`/energy/${id}`);
}
