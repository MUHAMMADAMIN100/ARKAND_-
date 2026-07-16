import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  TripType,
  type CreateFuelLogInput,
  type CreateMaintenanceInput,
  type CreateTripInput,
  type CreateVehicleInput,
  type FuelLogDto,
  type MaintenanceDto,
  type Paginated,
  type TripDto,
  type UpdateVehicleInput,
  type VehicleDto,
} from '@sheben/shared';
import { buildPaginated, skipTake, type RequestUser } from '../../common';
import type { FuelLogFilter, MaintenanceFilter, TripFilter, VehicleListFilter } from './fleet.filters';
import { FleetRepository } from './fleet.repository';
import { toFuelLogDto, toMaintenanceDto, toTripDto, toVehicleDto } from './fleet.mapper';

/** Роли водителей — видят и вносят только свои рейсы (ABAC). */
const DRIVER_ROLES: Role[] = [Role.DUMP_TRUCK_DRIVER, Role.EXCAVATOR_DRIVER];

/** Окно для сводки расходов на технику в списке машин. */
const COST_WINDOW_DAYS = 30;

function daysAgo(days: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days));
}

@Injectable()
export class FleetService {
  constructor(private readonly repo: FleetRepository) {}

  // ---------- Vehicles ----------

  async listVehicles(filter: VehicleListFilter): Promise<VehicleDto[]> {
    const vehicles = await this.repo.findVehicles(filter);
    if (vehicles.length === 0) return [];

    const vehicleIds = vehicles.map((v) => v.id);
    const since = daysAgo(COST_WINDOW_DAYS);
    const [fuelCosts, maintenanceCosts] = await Promise.all([
      this.repo.sumFuelCostSince(vehicleIds, since),
      this.repo.sumMaintenanceCostSince(vehicleIds, since),
    ]);

    return vehicles.map((vehicle) =>
      toVehicleDto(vehicle, {
        fuelCost30d: fuelCosts.get(vehicle.id) ?? 0,
        maintenanceCost30d: maintenanceCosts.get(vehicle.id) ?? 0,
      }),
    );
  }

  async createVehicle(input: CreateVehicleInput): Promise<VehicleDto> {
    const vehicle = await this.repo.createVehicle(input);
    return toVehicleDto(vehicle);
  }

  async updateVehicle(id: string, input: UpdateVehicleInput): Promise<VehicleDto> {
    await this.ensureVehicleExists(id);
    const vehicle = await this.repo.updateVehicle(id, input);
    return toVehicleDto(vehicle);
  }

  async deactivateVehicle(id: string): Promise<VehicleDto> {
    await this.ensureVehicleExists(id);
    const vehicle = await this.repo.deactivateVehicle(id);
    return toVehicleDto(vehicle);
  }

  // ---------- Maintenance ----------

  async listMaintenance(filter: MaintenanceFilter): Promise<Paginated<MaintenanceDto>> {
    const { skip, take } = skipTake(filter.page, filter.pageSize);
    const [items, total] = await Promise.all([
      this.repo.findMaintenance(filter, skip, take),
      this.repo.countMaintenance(filter),
    ]);
    return buildPaginated(items.map(toMaintenanceDto), total, filter.page, filter.pageSize);
  }

  async createMaintenance(input: CreateMaintenanceInput, mechanicId: string): Promise<MaintenanceDto> {
    await this.ensureVehicleExists(input.vehicleId);
    const record = await this.repo.createMaintenance(input, mechanicId);
    return toMaintenanceDto(record);
  }

  // ---------- Fuel logs ----------

  async listFuelLogs(filter: FuelLogFilter): Promise<Paginated<FuelLogDto>> {
    const { skip, take } = skipTake(filter.page, filter.pageSize);
    const [items, total] = await Promise.all([
      this.repo.findFuelLogs(filter, skip, take),
      this.repo.countFuelLogs(filter),
    ]);
    return buildPaginated(items.map(toFuelLogDto), total, filter.page, filter.pageSize);
  }

  async createFuelLog(input: CreateFuelLogInput, byUserId: string): Promise<FuelLogDto> {
    await this.ensureVehicleExists(input.vehicleId);
    const log = await this.repo.createFuelLog(input, byUserId);
    return toFuelLogDto(log);
  }

  // ---------- Trips ----------

  async listTrips(filter: TripFilter, user: RequestUser): Promise<Paginated<TripDto>> {
    const driverIdOverride = this.ownDriverIdOverride(user);
    const { skip, take } = skipTake(filter.page, filter.pageSize);
    const [items, total] = await Promise.all([
      this.repo.findTrips(filter, driverIdOverride, skip, take),
      this.repo.countTrips(filter, driverIdOverride),
    ]);
    return buildPaginated(items.map(toTripDto), total, filter.page, filter.pageSize);
  }

  async createTrip(input: CreateTripInput, user: RequestUser): Promise<TripDto> {
    await this.ensureVehicleExists(input.vehicleId);

    if (input.type === TripType.DELIVERY && input.talonId) {
      const talon = await this.repo.findTalonById(input.talonId);
      if (!talon) throw new NotFoundException('Талон не найден');
    }

    // Водитель всегда фиксирует рейс за собой — принудительно игнорируем переданный driverId.
    const driverId = this.ownDriverIdOverride(user) ?? input.driverId;

    const trip = await this.repo.createTrip(input, driverId, user.id);
    return toTripDto(trip);
  }

  /** Для ролей-водителей — их собственный id, иначе undefined (не ограничиваем). */
  private ownDriverIdOverride(user: RequestUser): string | undefined {
    return DRIVER_ROLES.includes(user.role) ? user.id : undefined;
  }

  private async ensureVehicleExists(id: string): Promise<void> {
    const vehicle = await this.repo.findVehicleById(id);
    if (!vehicle) throw new NotFoundException('Машина не найдена');
  }
}
