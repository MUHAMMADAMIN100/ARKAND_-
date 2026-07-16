import type { DebtEntryDto } from '@sheben/shared';
import { decToNum } from '../../common';
import type { DebtEntryEntity } from './debt-registry.repository';

export function toDebtEntryDto(entity: DebtEntryEntity): DebtEntryDto {
  return {
    id: entity.id,
    clientId: entity.clientId,
    clientName: entity.client.name,
    type: entity.type,
    amount: decToNum(entity.amount),
    date: entity.date.toISOString().slice(0, 10),
    refType: entity.refType,
    refId: entity.refId,
    note: entity.note,
    byUserId: entity.byUserId,
    byUserName: entity.byUser.fullName,
    createdAt: entity.createdAt.toISOString(),
  };
}
