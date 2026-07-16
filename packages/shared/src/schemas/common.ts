import { z } from 'zod';

/** Денежная сумма: > 0, максимум 2 знака после запятой. */
export const moneySchema = z
  .number()
  .positive('Сумма должна быть больше нуля')
  .max(999_999_999_999, 'Слишком большая сумма')
  .multipleOf(0.01, 'Максимум 2 знака после запятой');

/** Количество (м³/т): > 0, максимум 3 знака после запятой. */
export const qtySchema = z
  .number()
  .positive('Количество должно быть больше нуля')
  .max(999_999_999, 'Слишком большое количество');

/** Неотрицательное количество (для факта инвентаризации и т.п.). */
export const qtyOrZeroSchema = z
  .number()
  .min(0, 'Количество не может быть отрицательным')
  .max(999_999_999, 'Слишком большое количество');

export const uuidSchema = z.uuid('Некорректный идентификатор');

/** Дата в ISO-формате (YYYY-MM-DD или полный ISO datetime). */
export const dateStringSchema = z
  .string()
  .min(10, 'Укажите дату')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Некорректная дата');

export const offsetPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type OffsetPagination = z.infer<typeof offsetPaginationSchema>;

/** Keyset-пагинация для больших таблиц (движения, аудит, талоны). */
export const cursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type CursorPagination = z.infer<typeof cursorPaginationSchema>;

export const dateRangeSchema = z.object({
  from: dateStringSchema.optional(),
  to: dateStringSchema.optional(),
});
export type DateRange = z.infer<typeof dateRangeSchema>;

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}
