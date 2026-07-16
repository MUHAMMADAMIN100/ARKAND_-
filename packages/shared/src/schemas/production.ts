import { z } from 'zod';
import { ShiftStatus } from '../enums';
import { dateStringSchema, qtyOrZeroSchema, qtySchema, uuidSchema } from './common';

export const openShiftSchema = z.object({
  date: dateStringSchema,
  shiftNumber: z.number().int().min(1).max(3).default(1),
  note: z.string().max(500).optional(),
});
export type OpenShiftInput = z.infer<typeof openShiftSchema>;

export const outputEntrySchema = z.object({
  productId: uuidSchema,
  quantity: qtySchema,
});

/** Внесение выпуска по фракциям за смену (ЩЕБ-12). */
export const recordOutputSchema = z.object({
  outputs: z.array(outputEntrySchema).min(1, 'Укажите выпуск хотя бы по одной фракции'),
  /** Израсходовано горной массы (м³) — списывается со склада сырья. */
  rawConsumed: qtyOrZeroSchema.optional(),
});
export type RecordOutputInput = z.infer<typeof recordOutputSchema>;

export const closeShiftSchema = z.object({
  note: z.string().max(500).optional(),
});
export type CloseShiftInput = z.infer<typeof closeShiftSchema>;

export interface ShiftOutputDto {
  id: string;
  productId: string;
  productName: string;
  unit: string;
  quantity: number;
}

export interface ProductionShiftDto {
  id: string;
  date: string;
  shiftNumber: number;
  status: ShiftStatus;
  operatorId: string;
  operatorName: string;
  rawConsumed: number;
  totalOutput: number;
  outputs: ShiftOutputDto[];
  note: string | null;
  closedAt: string | null;
  createdAt: string;
}
