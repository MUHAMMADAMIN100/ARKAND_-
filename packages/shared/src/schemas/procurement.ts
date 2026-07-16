import { z } from 'zod';
import { ApprovalDecision, PurchaseStatus, Unit } from '../enums';
import { dateStringSchema, moneySchema, qtySchema, uuidSchema } from './common';

/** Заявка на закупку (ЩЕБ-41, СНБ-01). */
export const createPurchaseRequestSchema = z.object({
  title: z.string().min(3, 'Что закупаем?').max(200),
  productId: uuidSchema.optional(),
  quantity: qtySchema.optional(),
  unit: z.enum(Unit).optional(),
  estimatedCost: moneySchema.optional(),
  supplierName: z.string().max(200).optional(),
  note: z.string().max(1000).optional(),
});
export type CreatePurchaseRequestInput = z.infer<typeof createPurchaseRequestSchema>;

export const updatePurchaseRequestSchema = createPurchaseRequestSchema.partial();
export type UpdatePurchaseRequestInput = z.infer<typeof updatePurchaseRequestSchema>;

/** Решение владельца по крупной закупке (ХОЛ-23, ВЛД-21): добро / нет. */
export const ownerDecisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  note: z.string().max(500).optional(),
});
export type OwnerDecisionInput = z.infer<typeof ownerDecisionSchema>;

/** Отметка о фактической закупке. */
export const markPurchasedSchema = z.object({
  actualCost: moneySchema,
  supplierName: z.string().max(200).optional(),
  date: dateStringSchema.optional(),
});
export type MarkPurchasedInput = z.infer<typeof markPurchasedSchema>;

/** Оприходование на склад (СНБ-05). */
export const receivePurchaseSchema = z.object({
  quantity: qtySchema.optional(),
});
export type ReceivePurchaseInput = z.infer<typeof receivePurchaseSchema>;

export interface OwnerApprovalDto {
  id: string;
  ownerId: string;
  ownerName: string;
  decision: ApprovalDecision;
  note: string | null;
  decidedAt: string | null;
}

export interface PurchaseRequestDto {
  id: string;
  number: number;
  title: string;
  productId: string | null;
  productName: string | null;
  quantity: number | null;
  unit: Unit | null;
  estimatedCost: number | null;
  actualCost: number | null;
  supplierName: string | null;
  status: PurchaseStatus;
  isLarge: boolean;
  isAuto: boolean;
  approvals: OwnerApprovalDto[];
  note: string | null;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}
