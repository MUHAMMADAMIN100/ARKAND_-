import { z } from 'zod';
import { ProductKind, Unit } from '../enums';
import { moneySchema, qtyOrZeroSchema } from './common';

export const createProductSchema = z.object({
  name: z.string().min(2, 'Укажите название').max(120),
  kind: z.enum(ProductKind),
  unit: z.enum(Unit).default(Unit.M3),
  price: moneySchema,
  minStock: qtyOrZeroSchema.optional(),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export interface ProductDto {
  id: string;
  name: string;
  kind: ProductKind;
  unit: Unit;
  price: number;
  minStock: number | null;
  isActive: boolean;
  sortOrder: number;
  /** Текущий остаток на складе готовой продукции (или сырья для RAW). */
  stock: number;
}
