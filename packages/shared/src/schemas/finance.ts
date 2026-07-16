import { z } from 'zod';
import { CashCategory, CashDirection, CashStatus, DebtEntryType, PaymentMethod } from '../enums';
import { dateStringSchema, moneySchema, uuidSchema } from './common';

/** Приход/расход кассы (ЩЕБ-60, ЩЕБ-61). */
export const createCashTransactionSchema = z
  .object({
    direction: z.enum(CashDirection),
    amount: moneySchema,
    method: z.enum(PaymentMethod).refine((m) => m !== 'BARTER', 'Бартер проводится через долги, не через кассу'),
    category: z.enum(CashCategory),
    date: dateStringSchema,
    clientId: uuidSchema.optional(),
    orderId: uuidSchema.optional(),
    note: z.string().max(500).optional(),
  })
  .check((ctx) => {
    const v = ctx.value;
    const incomeCategories: CashCategory[] = ['SALE', 'OTHER_INCOME'];
    if (v.direction === 'INCOME' && !incomeCategories.includes(v.category)) {
      ctx.issues.push({ code: 'custom', message: 'Для прихода выберите категорию прихода', path: ['category'], input: v.category });
    }
    if (v.direction === 'EXPENSE' && incomeCategories.includes(v.category)) {
      ctx.issues.push({ code: 'custom', message: 'Для расхода выберите категорию расхода', path: ['category'], input: v.category });
    }
  });
export type CreateCashTransactionInput = z.infer<typeof createCashTransactionSchema>;

export const cashDecisionSchema = z.object({
  decision: z.enum(['CONFIRM', 'REJECT']),
  note: z.string().max(500).optional(),
});
export type CashDecisionInput = z.infer<typeof cashDecisionSchema>;

export const cashFilterSchema = z.object({
  direction: z.enum(CashDirection).optional(),
  status: z.enum(CashStatus).optional(),
  category: z.enum(CashCategory).optional(),
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type CashFilter = z.infer<typeof cashFilterSchema>;

/** Погашение/взаимозачёт долга (ХОЛ-32). */
export const createDebtEntrySchema = z.object({
  clientId: uuidSchema,
  type: z.enum(DebtEntryType).refine((t) => t !== 'SHIPMENT', 'Долг за отгрузку создаётся автоматически'),
  amount: moneySchema,
  date: dateStringSchema,
  note: z.string().max(500).optional(),
});
export type CreateDebtEntryInput = z.infer<typeof createDebtEntrySchema>;

export interface CashTransactionDto {
  id: string;
  number: number;
  direction: CashDirection;
  amount: number;
  method: PaymentMethod;
  category: CashCategory;
  status: CashStatus;
  date: string;
  clientId: string | null;
  clientName: string | null;
  orderId: string | null;
  orderNumber: number | null;
  cashierId: string;
  cashierName: string;
  confirmedById: string | null;
  confirmedByName: string | null;
  confirmedAt: string | null;
  note: string | null;
  createdAt: string;
}

export interface DebtEntryDto {
  id: string;
  clientId: string;
  clientName: string;
  type: DebtEntryType;
  amount: number;
  date: string;
  refType: string | null;
  refId: string | null;
  note: string | null;
  byUserId: string;
  byUserName: string;
  createdAt: string;
}

export interface DebtBalanceDto {
  clientId: string;
  clientName: string;
  balance: number;
  lastEntryAt: string | null;
}
