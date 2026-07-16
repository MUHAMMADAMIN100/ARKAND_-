import { z } from 'zod';
import { TripType, VehicleType, dateStringSchema, offsetPaginationSchema, uuidSchema } from '@sheben/shared';

/** ?type=&active= — список техники (без пагинации). */
export const vehicleListFilterSchema = z.object({
  type: z.enum(VehicleType).optional(),
  active: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});
export type VehicleListFilter = z.infer<typeof vehicleListFilterSchema>;

/** Журнал ТО/ремонтов — offset-пагинация + фильтр по машине и периоду. */
export const maintenanceFilterSchema = offsetPaginationSchema.extend({
  vehicleId: uuidSchema.optional(),
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
});
export type MaintenanceFilter = z.infer<typeof maintenanceFilterSchema>;

/** Журнал заправок — offset-пагинация + фильтр по машине и периоду. */
export const fuelLogFilterSchema = offsetPaginationSchema.extend({
  vehicleId: uuidSchema.optional(),
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
});
export type FuelLogFilter = z.infer<typeof fuelLogFilterSchema>;

/** Рейсы — offset-пагинация + фильтр по машине/водителю/типу/дате. */
export const tripFilterSchema = offsetPaginationSchema.extend({
  vehicleId: uuidSchema.optional(),
  driverId: uuidSchema.optional(),
  type: z.enum(TripType).optional(),
  date: dateStringSchema.optional(),
});
export type TripFilter = z.infer<typeof tripFilterSchema>;
