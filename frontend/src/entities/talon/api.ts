import { http } from '../../shared/api/http';
import type { CreateTalonInput, CursorPage, TalonDto, TalonFilter, UserDto, VehicleDto } from '@sheben/shared';

export const talonKeys = {
  all: ['talons'] as const,
  list: (filter: Partial<TalonFilter>) => ['talons', 'list', filter] as const,
  detail: (id: string) => ['talons', 'detail', id] as const,
};

export function fetchTalons(filter: Partial<TalonFilter>): Promise<CursorPage<TalonDto>> {
  return http.get<CursorPage<TalonDto>>('/talons', {
    query: filter as Record<string, string | number | undefined>,
  });
}

export function fetchTalon(id: string): Promise<TalonDto> {
  return http.get<TalonDto>(`/talons/${id}`);
}

export function createTalon(input: CreateTalonInput): Promise<TalonDto> {
  return http.post<TalonDto>('/talons', input);
}

export function shipTalon(id: string): Promise<TalonDto> {
  return http.patch<TalonDto>(`/talons/${id}/ship`);
}

export function deliverTalon(id: string): Promise<TalonDto> {
  return http.patch<TalonDto>(`/talons/${id}/deliver`);
}

export function cancelTalon(id: string): Promise<TalonDto> {
  return http.patch<TalonDto>(`/talons/${id}/cancel`);
}

/** Справочник техники — нужен только форме выдачи талона. */
export const vehicleKeys = {
  list: (params?: Record<string, unknown>) => ['vehicles', 'list', params ?? {}] as const,
};

export function fetchVehicles(params?: { type?: string }): Promise<VehicleDto[]> {
  return http.get<VehicleDto[]>('/fleet/vehicles', {
    query: params as Record<string, string | undefined>,
  });
}

/** Справочник водителей (пользователи с ролью шофёра) — нужен только форме выдачи талона. */
export const driverKeys = {
  list: (role: string) => ['users', 'drivers', role] as const,
};

export function fetchDrivers(role: string): Promise<{ items: UserDto[] }> {
  return http.get<{ items: UserDto[] }>('/users', {
    query: { role } as Record<string, string | undefined>,
  });
}
