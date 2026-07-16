import { z } from 'zod';
import { ClientType } from '../enums';

export const createClientSchema = z.object({
  name: z.string().min(2, 'Укажите название/имя').max(160),
  type: z.enum(ClientType).default(ClientType.EXTERNAL),
  phone: z.string().max(32).optional(),
  note: z.string().max(500).optional(),
});
export type CreateClientInput = z.infer<typeof createClientSchema>;

export const updateClientSchema = createClientSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateClientInput = z.infer<typeof updateClientSchema>;

export interface ClientDto {
  id: string;
  name: string;
  type: ClientType;
  phone: string | null;
  note: string | null;
  isActive: boolean;
  /** Текущий баланс долга (для INTERNAL): >0 — должны нам. */
  debtBalance?: number;
  createdAt: string;
}
