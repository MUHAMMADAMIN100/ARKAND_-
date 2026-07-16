import { http } from '../../shared/api/http';
import type {
  CreateFuelLogInput,
  CreateMaintenanceInput,
  CreateTripInput,
  CreateVehicleInput,
  FuelLogDto,
  MaintenanceDto,
  Paginated,
  TripDto,
  TripType,
  UpdateVehicleInput,
  VehicleDto,
  VehicleType,
} from '@sheben/shared';

export const fleetKeys = {
  all: ['fleet'] as const,
  vehicles: (params?: Record<string, unknown>) => ['fleet', 'vehicles', params ?? {}] as const,
  maintenance: (params?: Record<string, unknown>) => ['fleet', 'maintenance', params ?? {}] as const,
  fuel: (params?: Record<string, unknown>) => ['fleet', 'fuel', params ?? {}] as const,
  trips: (params?: Record<string, unknown>) => ['fleet', 'trips', params ?? {}] as const,
};

// ---------- Vehicles ----------

export type VehicleListParams = {
  type?: VehicleType;
  active?: boolean;
}

export function fetchVehicles(params?: VehicleListParams): Promise<VehicleDto[]> {
  return http.get<VehicleDto[]>('/fleet/vehicles', {
    query: params as Record<string, string | boolean | undefined>,
  });
}

export function createVehicle(input: CreateVehicleInput): Promise<VehicleDto> {
  return http.post<VehicleDto>('/fleet/vehicles', input);
}

export function updateVehicle(id: string, input: UpdateVehicleInput): Promise<VehicleDto> {
  return http.patch<VehicleDto>(`/fleet/vehicles/${id}`, input);
}

/** Деактивация машины (мягкое удаление на бэкенде, возвращает обновлённую машину). */
export function deleteVehicle(id: string): Promise<VehicleDto> {
  return http.delete<VehicleDto>(`/fleet/vehicles/${id}`);
}

// ---------- Maintenance (ТО/ремонты) ----------

export type MaintenanceListParams = {
  vehicleId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export function fetchMaintenance(params?: MaintenanceListParams): Promise<Paginated<MaintenanceDto>> {
  return http.get<Paginated<MaintenanceDto>>('/fleet/maintenance', {
    query: params as Record<string, string | number | undefined>,
  });
}

export function createMaintenance(input: CreateMaintenanceInput): Promise<MaintenanceDto> {
  return http.post<MaintenanceDto>('/fleet/maintenance', input);
}

// ---------- Fuel (солярка) ----------

export type FuelListParams = {
  vehicleId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export function fetchFuelLogs(params?: FuelListParams): Promise<Paginated<FuelLogDto>> {
  return http.get<Paginated<FuelLogDto>>('/fleet/fuel', {
    query: params as Record<string, string | number | undefined>,
  });
}

export function createFuelLog(input: CreateFuelLogInput): Promise<FuelLogDto> {
  return http.post<FuelLogDto>('/fleet/fuel', input);
}

// ---------- Trips (рейсы) ----------

export type TripListParams = {
  vehicleId?: string;
  driverId?: string;
  type?: TripType;
  page?: number;
  pageSize?: number;
}

export function fetchTrips(params?: TripListParams): Promise<Paginated<TripDto>> {
  return http.get<Paginated<TripDto>>('/fleet/trips', {
    query: params as Record<string, string | number | undefined>,
  });
}

export function createTrip(input: CreateTripInput): Promise<TripDto> {
  return http.post<TripDto>('/fleet/trips', input);
}
