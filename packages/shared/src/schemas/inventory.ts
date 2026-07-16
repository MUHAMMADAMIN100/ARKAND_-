import { z } from 'zod';
import { InventoryScope, InventoryStatus } from '../enums';
import { qtyOrZeroSchema, uuidSchema } from './common';

/** Запуск инвентаризации (ИНВ-01, ИНВ-02): полная или частичная. */
export const startInventorySchema = z
  .object({
    warehouseId: uuidSchema,
    scope: z.enum(InventoryScope),
    /** Для частичной — список позиций. */
    productIds: z.array(uuidSchema).optional(),
    note: z.string().max(500).optional(),
  })
  .check((ctx) => {
    const v = ctx.value;
    if (v.scope === 'PARTIAL' && (!v.productIds || v.productIds.length === 0)) {
      ctx.issues.push({
        code: 'custom',
        message: 'Для частичной инвентаризации выберите позиции',
        path: ['productIds'],
        input: v.productIds,
      });
    }
  });
export type StartInventoryInput = z.infer<typeof startInventorySchema>;

/** Ввод факта пересчёта (ИНВ-04). */
export const countItemSchema = z.object({
  itemId: uuidSchema,
  factQty: qtyOrZeroSchema,
});
export const submitCountsSchema = z.object({
  counts: z.array(countItemSchema).min(1),
});
export type SubmitCountsInput = z.infer<typeof submitCountsSchema>;

/** Завершение: недостача — объяснение и ответственный (ИНВ-06). */
export const completeInventorySchema = z.object({
  shortages: z
    .array(
      z.object({
        itemId: uuidSchema,
        explanation: z.string().min(3, 'Объясните причину недостачи').max(1000),
        responsibleId: uuidSchema,
      }),
    )
    .optional(),
});
export type CompleteInventoryInput = z.infer<typeof completeInventorySchema>;

export interface InventoryItemDto {
  id: string;
  productId: string;
  productName: string;
  unit: string;
  systemQty: number;
  factQty: number | null;
  diffQty: number | null;
  diffAmount: number | null;
  explanation: string | null;
  responsibleId: string | null;
  responsibleName: string | null;
}

export interface InventoryDto {
  id: string;
  number: number;
  warehouseId: string;
  warehouseName: string;
  scope: InventoryScope;
  status: InventoryStatus;
  items: InventoryItemDto[];
  startedById: string;
  startedByName: string;
  countedById: string | null;
  countedByName: string | null;
  note: string | null;
  startedAt: string;
  completedAt: string | null;
}
