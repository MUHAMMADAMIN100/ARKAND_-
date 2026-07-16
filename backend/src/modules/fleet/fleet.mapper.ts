import type { FuelLog, MaintenanceRecord, Trip, Vehicle } from '@prisma/client';
import type { FuelLogDto, MaintenanceDto, TripDto, VehicleDto } from '@sheben/shared';
import { decToNum } from '../../common';

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export interface VehicleCosts {
  fuelCost30d: number;
  maintenanceCost30d: number;
}

export function toVehicleDto(vehicle: Vehicle, costs?: VehicleCosts): VehicleDto {
  return {
    id: vehicle.id,
    name: vehicle.name,
    type: vehicle.type,
    plate: vehicle.plate,
    isActive: vehicle.isActive,
    ...(costs ? { fuelCost30d: costs.fuelCost30d, maintenanceCost30d: costs.maintenanceCost30d } : {}),
  };
}

export type MaintenanceWithRelations = MaintenanceRecord & {
  vehicle: { name: string };
  mechanic: { fullName: string };
};

export function toMaintenanceDto(record: MaintenanceWithRelations): MaintenanceDto {
  return {
    id: record.id,
    vehicleId: record.vehicleId,
    vehicleName: record.vehicle.name,
    type: record.type,
    description: record.description,
    cost: decToNum(record.cost),
    date: toDateOnly(record.date),
    mechanicId: record.mechanicId,
    mechanicName: record.mechanic.fullName,
    createdAt: record.createdAt.toISOString(),
  };
}

export type FuelLogWithRelations = FuelLog & {
  vehicle: { name: string };
  byUser: { fullName: string };
};

export function toFuelLogDto(log: FuelLogWithRelations): FuelLogDto {
  return {
    id: log.id,
    vehicleId: log.vehicleId,
    vehicleName: log.vehicle.name,
    liters: decToNum(log.liters),
    cost: decToNum(log.cost),
    date: toDateOnly(log.date),
    byUserId: log.byUserId,
    byUserName: log.byUser.fullName,
    note: log.note,
  };
}

export type TripWithRelations = Trip & {
  vehicle: { name: string };
  driver: { fullName: string };
  talon: { number: number } | null;
};

export function toTripDto(trip: TripWithRelations): TripDto {
  return {
    id: trip.id,
    vehicleId: trip.vehicleId,
    vehicleName: trip.vehicle.name,
    driverId: trip.driverId,
    driverName: trip.driver.fullName,
    type: trip.type,
    date: toDateOnly(trip.date),
    quantity: trip.quantity !== null ? decToNum(trip.quantity) : null,
    talonId: trip.talonId,
    talonNumber: trip.talon ? trip.talon.number : null,
    note: trip.note,
    enteredById: trip.enteredById,
    createdAt: trip.createdAt.toISOString(),
  };
}
