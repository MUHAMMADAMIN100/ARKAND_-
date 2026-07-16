import { z } from 'zod';
import { StockMovementType, WarehouseType } from '../enums';
import { dateStringSchema, uuidSchema } from './common';

export const movementFilterSchema = z.object({
  warehouseId: uuidSchema.optional(),
  productId: uuidSchema.optional(),
  type: z.enum(StockMovementType).optional(),
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type MovementFilter = z.infer<typeof movementFilterSchema>;

export interface WarehouseDto {
  id: string;
  name: string;
  type: WarehouseType;
}

export interface StockItemDto {
  warehouseId: string;
  warehouseName: string;
  productId: string;
  productName: string;
  productKind: string;
  unit: string;
  quantity: number;
  minStock: number | null;
  /** Остаток ниже минимума → автозаявка (ЩЕБ-41). */
  belowMin: boolean;
}

export interface StockMovementDto {
  id: string;
  warehouseId: string;
  warehouseName: string;
  productId: string;
  productName: string;
  unit: string;
  type: StockMovementType;
  qty: number;
  refType: string | null;
  refId: string | null;
  byUserId: string;
  byUserName: string;
  comment: string | null;
  createdAt: string;
}
