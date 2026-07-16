import { z } from 'zod';
import { DeliveryType, OrderStatus, PaymentMethod } from '../enums';
import { dateStringSchema, moneySchema, qtySchema, uuidSchema } from './common';

export const orderItemInputSchema = z.object({
  productId: uuidSchema,
  quantity: qtySchema,
  /** Цена за единицу; если не задана — берётся из каталога на бэке. */
  price: moneySchema.optional(),
});
export type OrderItemInput = z.infer<typeof orderItemInputSchema>;

export const createOrderSchema = z.object({
  clientId: uuidSchema,
  paymentMethod: z.enum(PaymentMethod),
  deliveryType: z.enum(DeliveryType),
  plannedDate: dateStringSchema.optional(),
  note: z.string().max(500).optional(),
  items: z.array(orderItemInputSchema).min(1, 'Добавьте хотя бы одну позицию'),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const updateOrderSchema = createOrderSchema.partial();
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;

export const orderStatusChangeSchema = z.object({
  status: z.enum(OrderStatus),
});
export type OrderStatusChangeInput = z.infer<typeof orderStatusChangeSchema>;

export const orderFilterSchema = z.object({
  status: z.enum(OrderStatus).optional(),
  clientId: uuidSchema.optional(),
  paymentMethod: z.enum(PaymentMethod).optional(),
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
  search: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type OrderFilter = z.infer<typeof orderFilterSchema>;

export interface OrderItemDto {
  id: string;
  productId: string;
  productName: string;
  unit: string;
  quantity: number;
  price: number;
  amount: number;
  /** Уже отгружено по талонам. */
  shippedQty: number;
}

export interface OrderDto {
  id: string;
  number: number;
  clientId: string;
  clientName: string;
  clientType: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  deliveryType: DeliveryType;
  plannedDate: string | null;
  note: string | null;
  totalAmount: number;
  items: OrderItemDto[];
  createdById: string;
  createdByName: string;
  createdAt: string;
}
