import type { Client } from '@prisma/client';
import { ClientType, type ClientDto } from '@sheben/shared';

/** Client (Prisma) + баланс долга (для INTERNAL) -> ClientDto. */
export function toClientDto(client: Client, debtBalance?: number): ClientDto {
  return {
    id: client.id,
    name: client.name,
    type: client.type,
    phone: client.phone,
    note: client.note,
    isActive: client.isActive,
    ...(client.type === ClientType.INTERNAL ? { debtBalance: debtBalance ?? 0 } : {}),
    createdAt: client.createdAt.toISOString(),
  };
}
