import { z } from 'zod';
import { MaintenanceType, TripType, VehicleType } from '../enums';
import { dateStringSchema, moneySchema, qtySchema, uuidSchema } from './common';

export const createVehicleSchema = z.object({
  name: z.string().min(2, 'Укажите название').max(120),
  type: z.enum(VehicleType),
  plate: z.string().max(32).optional(),
});
export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;

export const updateVehicleSchema = createVehicleSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;

/** Журнал ремонтов и ТО — ведёт механик (ЩЕБ-51). */
export const createMaintenanceSchema = z.object({
  vehicleId: uuidSchema,
  type: z.enum(MaintenanceType),
  description: z.string().min(3, 'Опишите работы').max(1000),
  cost: moneySchema,
  date: dateStringSchema,
});
export type CreateMaintenanceInput = z.infer<typeof createMaintenanceSchema>;

/** Заправка/солярка по машине (ЩЕБ-30). */
export const createFuelLogSchema = z.object({
  vehicleId: uuidSchema,
  liters: qtySchema,
  cost: moneySchema,
  date: dateStringSchema,
  note: z.string().max(500).optional(),
});
export type CreateFuelLogInput = z.infer<typeof createFuelLogSchema>;

/** Рейс: возка породы или доставка по талону. */
export const createTripSchema = z
  .object({
    vehicleId: uuidSchema,
    driverId: uuidSchema,
    type: z.enum(TripType),
    date: dateStringSchema,
    /** Объём породы за рейс (для RAW_HAUL). */
    quantity: qtySchema.optional(),
    /** Талон (для DELIVERY). */
    talonId: uuidSchema.optional(),
    note: z.string().max(500).optional(),
  })
  .check((ctx) => {
    const v = ctx.value;
    if (v.type === TripType.RAW_HAUL && v.quantity == null) {
      ctx.issues.push({ code: 'custom', message: 'Укажите объём породы за рейс', path: ['quantity'], input: v.quantity });
    }
    if (v.type === TripType.DELIVERY && !v.talonId) {
      ctx.issues.push({ code: 'custom', message: 'Укажите талон доставки', path: ['talonId'], input: v.talonId });
    }
  });
export type CreateTripInput = z.infer<typeof createTripSchema>;

export interface VehicleDto {
  id: string;
  name: string;
  type: VehicleType;
  plate: string | null;
  isActive: boolean;
  /** Сводка: расход солярки и стоимость ремонтов за последние 30 дней. */
  fuelCost30d?: number;
  maintenanceCost30d?: number;
}

export interface MaintenanceDto {
  id: string;
  vehicleId: string;
  vehicleName: string;
  type: MaintenanceType;
  description: string;
  cost: number;
  date: string;
  mechanicId: string;
  mechanicName: string;
  createdAt: string;
}

export interface FuelLogDto {
  id: string;
  vehicleId: string;
  vehicleName: string;
  liters: number;
  cost: number;
  date: string;
  byUserId: string;
  byUserName: string;
  note: string | null;
}

export interface TripDto {
  id: string;
  vehicleId: string;
  vehicleName: string;
  driverId: string;
  driverName: string;
  type: TripType;
  date: string;
  quantity: number | null;
  talonId: string | null;
  talonNumber: number | null;
  note: string | null;
  enteredById: string;
  createdAt: string;
}
