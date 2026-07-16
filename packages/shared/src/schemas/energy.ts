import { z } from 'zod';
import { dateStringSchema, moneySchema, qtySchema } from './common';

/** Учёт электроэнергии за период/месяц (ЩЕБ-31). */
export const createElectricityLogSchema = z.object({
  /** Месяц учёта — первое число месяца, YYYY-MM-DD. */
  month: dateStringSchema,
  kwh: qtySchema,
  cost: moneySchema,
  note: z.string().max(500).optional(),
});
export type CreateElectricityLogInput = z.infer<typeof createElectricityLogSchema>;

export const updateElectricityLogSchema = createElectricityLogSchema.partial();
export type UpdateElectricityLogInput = z.infer<typeof updateElectricityLogSchema>;

export interface ElectricityLogDto {
  id: string;
  month: string;
  kwh: number;
  cost: number;
  note: string | null;
  byUserId: string;
  byUserName: string;
  /** Выпуск продукции за этот месяц — для привязки к выпуску (ЩЕБ-31). */
  monthOutput: number;
  createdAt: string;
}
