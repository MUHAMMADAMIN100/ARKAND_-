import { Injectable } from '@nestjs/common';
import { Prisma, type Talon, type Vehicle } from '@prisma/client';
import type { CreateFuelLogInput, CreateMaintenanceInput, CreateTripInput, CreateVehicleInput, UpdateVehicleInput } from '@sheben/shared';
import { TransactionHost, decToNum, numToDec } from '../../common';
import type { FuelLogFilter, MaintenanceFilter, TripFilter, VehicleListFilter } from './fleet.filters';
import type { FuelLogWithRelations, MaintenanceWithRelations, TripWithRelations } from './fleet.mapper';

const MAINTENANCE_INCLUDE = {
  vehicle: { select: { name: true } },
  mechanic: { select: { fullName: true } },
} satisfies Prisma.MaintenanceRecordInclude;

const FUEL_LOG_INCLUDE = {
  vehicle: { select: { name: true } },
  byUser: { select: { fullName: true } },
} satisfies Prisma.FuelLogInclude;

const TRIP_INCLUDE = {
  vehicle: { select: { name: true } },
  driver: { select: { fullName: true } },
  talon: { select: { number: true } },
} satisfies Prisma.TripInclude;

@Injectable()
export class FleetRepository {
  constructor(private readonly txHost: TransactionHost) {}

  private get db(): Prisma.TransactionClient {
    return this.txHost.tx as Prisma.TransactionClient;
  }

  // ---------- Vehicles ----------

  findVehicles(filter: VehicleListFilter): Promise<Vehicle[]> {
    return this.db.vehicle.findMany({
      where: {
        ...(filter.type ? { type: filter.type } : {}),
        ...(filter.active !== undefined ? { isActive: filter.active } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  findVehicleById(id: string): Promise<Vehicle | null> {
    return this.db.vehicle.findUnique({ where: { id } });
  }

  createVehicle(input: CreateVehicleInput): Promise<Vehicle> {
    return this.db.vehicle.create({
      data: { name: input.name, type: input.type, plate: input.plate ?? null },
    });
  }

  updateVehicle(id: string, input: UpdateVehicleInput): Promise<Vehicle> {
    return this.db.vehicle.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.plate !== undefined ? { plate: input.plate ?? null } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
  }

  deactivateVehicle(id: string): Promise<Vehicle> {
    return this.db.vehicle.update({ where: { id }, data: { isActive: false } });
  }

  /** Сумма fuel_logs.cost по машинам за период (сгруппировано, без N+1). */
  async sumFuelCostSince(vehicleIds: string[], since: Date): Promise<Map<string, number>> {
    if (vehicleIds.length === 0) return new Map();
    const rows = await this.db.fuelLog.groupBy({
      by: ['vehicleId'],
      where: { vehicleId: { in: vehicleIds }, date: { gte: since } },
      _sum: { cost: true },
    });
    const map = new Map<string, number>();
    for (const row of rows) map.set(row.vehicleId, decToNum(row._sum.cost));
    return map;
  }

  /** Сумма maintenance_records.cost по машинам за период (сгруппировано, без N+1). */
  async sumMaintenanceCostSince(vehicleIds: string[], since: Date): Promise<Map<string, number>> {
    if (vehicleIds.length === 0) return new Map();
    const rows = await this.db.maintenanceRecord.groupBy({
      by: ['vehicleId'],
      where: { vehicleId: { in: vehicleIds }, date: { gte: since } },
      _sum: { cost: true },
    });
    const map = new Map<string, number>();
    for (const row of rows) map.set(row.vehicleId, decToNum(row._sum.cost));
    return map;
  }

  // ---------- Maintenance ----------

  countMaintenance(filter: MaintenanceFilter): Promise<number> {
    return this.db.maintenanceRecord.count({ where: this.buildMaintenanceWhere(filter) });
  }

  findMaintenance(filter: MaintenanceFilter, skip: number, take: number): Promise<MaintenanceWithRelations[]> {
    return this.db.maintenanceRecord.findMany({
      where: this.buildMaintenanceWhere(filter),
      include: MAINTENANCE_INCLUDE,
      orderBy: { date: 'desc' },
      skip,
      take,
    });
  }

  createMaintenance(input: CreateMaintenanceInput, mechanicId: string): Promise<MaintenanceWithRelations> {
    return this.db.maintenanceRecord.create({
      data: {
        vehicleId: input.vehicleId,
        type: input.type,
        description: input.description,
        cost: numToDec(input.cost),
        date: new Date(input.date),
        mechanicId,
      },
      include: MAINTENANCE_INCLUDE,
    });
  }

  private buildMaintenanceWhere(filter: MaintenanceFilter): Prisma.MaintenanceRecordWhereInput {
    return {
      ...(filter.vehicleId ? { vehicleId: filter.vehicleId } : {}),
      ...(filter.from || filter.to
        ? {
            date: {
              ...(filter.from ? { gte: new Date(filter.from) } : {}),
              ...(filter.to ? { lte: new Date(filter.to) } : {}),
            },
          }
        : {}),
    };
  }

  // ---------- Fuel logs ----------

  countFuelLogs(filter: FuelLogFilter): Promise<number> {
    return this.db.fuelLog.count({ where: this.buildFuelLogWhere(filter) });
  }

  findFuelLogs(filter: FuelLogFilter, skip: number, take: number): Promise<FuelLogWithRelations[]> {
    return this.db.fuelLog.findMany({
      where: this.buildFuelLogWhere(filter),
      include: FUEL_LOG_INCLUDE,
      orderBy: { date: 'desc' },
      skip,
      take,
    });
  }

  createFuelLog(input: CreateFuelLogInput, byUserId: string): Promise<FuelLogWithRelations> {
    return this.db.fuelLog.create({
      data: {
        vehicleId: input.vehicleId,
        liters: numToDec(input.liters),
        cost: numToDec(input.cost),
        date: new Date(input.date),
        byUserId,
        note: input.note ?? null,
      },
      include: FUEL_LOG_INCLUDE,
    });
  }

  private buildFuelLogWhere(filter: FuelLogFilter): Prisma.FuelLogWhereInput {
    return {
      ...(filter.vehicleId ? { vehicleId: filter.vehicleId } : {}),
      ...(filter.from || filter.to
        ? {
            date: {
              ...(filter.from ? { gte: new Date(filter.from) } : {}),
              ...(filter.to ? { lte: new Date(filter.to) } : {}),
            },
          }
        : {}),
    };
  }

  // ---------- Trips ----------

  countTrips(filter: TripFilter, driverIdOverride: string | undefined): Promise<number> {
    return this.db.trip.count({ where: this.buildTripWhere(filter, driverIdOverride) });
  }

  findTrips(filter: TripFilter, driverIdOverride: string | undefined, skip: number, take: number): Promise<TripWithRelations[]> {
    return this.db.trip.findMany({
      where: this.buildTripWhere(filter, driverIdOverride),
      include: TRIP_INCLUDE,
      orderBy: { date: 'desc' },
      skip,
      take,
    });
  }

  createTrip(input: CreateTripInput, driverId: string, enteredById: string): Promise<TripWithRelations> {
    return this.db.trip.create({
      data: {
        vehicleId: input.vehicleId,
        driverId,
        type: input.type,
        date: new Date(input.date),
        quantity: input.quantity !== undefined ? numToDec(input.quantity) : null,
        talonId: input.talonId ?? null,
        note: input.note ?? null,
        enteredById,
      },
      include: TRIP_INCLUDE,
    });
  }

  findTalonById(id: string): Promise<Talon | null> {
    return this.db.talon.findUnique({ where: { id } });
  }

  private buildTripWhere(filter: TripFilter, driverIdOverride: string | undefined): Prisma.TripWhereInput {
    const driverId = driverIdOverride ?? filter.driverId;
    return {
      ...(filter.vehicleId ? { vehicleId: filter.vehicleId } : {}),
      ...(driverId ? { driverId } : {}),
      ...(filter.type ? { type: filter.type } : {}),
      ...(filter.date ? { date: new Date(filter.date) } : {}),
    };
  }
}
