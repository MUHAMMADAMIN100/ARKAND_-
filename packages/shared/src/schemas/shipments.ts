import { z } from 'zod';
import { DeliveryType, TalonStatus } from '../enums';
import { dateStringSchema, moneySchema, qtySchema, uuidSchema } from './common';

/** Выдача цифрового талона на машину (ЩЕБ-21). */
export const createTalonSchema = z
  .object({
    orderId: uuidSchema,
    productId: uuidSchema,
    quantity: qtySchema,
    price: moneySchema.optional(),
    deliveryType: z.enum(DeliveryType),
    /** Свой транспорт: обязательны машина и водитель. */
    vehicleId: uuidSchema.optional(),
    driverId: uuidSchema.optional(),
    /** Самовывоз: номер машины клиента. */
    clientVehiclePlate: z.string().max(32).optional(),
    note: z.string().max(500).optional(),
  })
  .check((ctx) => {
    const v = ctx.value;
    if (v.deliveryType === DeliveryType.DELIVERY) {
      if (!v.vehicleId) {
        ctx.issues.push({ code: 'custom', message: 'Для доставки укажите машину', path: ['vehicleId'], input: v.vehicleId });
      }
      if (!v.driverId) {
        ctx.issues.push({ code: 'custom', message: 'Для доставки укажите водителя', path: ['driverId'], input: v.driverId });
      }
    }
    if (v.deliveryType === DeliveryType.PICKUP && !v.clientVehiclePlate) {
      ctx.issues.push({
        code: 'custom',
        message: 'Для самовывоза укажите номер машины клиента',
        path: ['clientVehiclePlate'],
        input: v.clientVehiclePlate,
      });
    }
  });
export type CreateTalonInput = z.infer<typeof createTalonSchema>;

export const talonFilterSchema = z.object({
  status: z.enum(TalonStatus).optional(),
  orderId: uuidSchema.optional(),
  driverId: uuidSchema.optional(),
  vehicleId: uuidSchema.optional(),
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type TalonFilter = z.infer<typeof talonFilterSchema>;

export interface TalonDto {
  id: string;
  number: number;
  orderId: string;
  orderNumber: number;
  clientName: string;
  productId: string;
  productName: string;
  unit: string;
  quantity: number;
  price: number;
  amount: number;
  deliveryType: DeliveryType;
  status: TalonStatus;
  vehicleId: string | null;
  vehicleName: string | null;
  driverId: string | null;
  driverName: string | null;
  clientVehiclePlate: string | null;
  note: string | null;
  issuedById: string;
  issuedByName: string;
  issuedAt: string;
  shippedAt: string | null;
  deliveredAt: string | null;
}
