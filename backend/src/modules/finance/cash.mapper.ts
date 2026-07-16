import type { CashTransactionDto } from '@sheben/shared';
import { decToNum } from '../../common';
import type { CashTransactionEntity } from './cash.repository';

export function toCashTransactionDto(entity: CashTransactionEntity): CashTransactionDto {
  return {
    id: entity.id,
    number: entity.number,
    direction: entity.direction,
    amount: decToNum(entity.amount),
    method: entity.method,
    category: entity.category,
    status: entity.status,
    date: entity.date.toISOString().slice(0, 10),
    clientId: entity.clientId,
    clientName: entity.client?.name ?? null,
    orderId: entity.orderId,
    orderNumber: entity.order?.number ?? null,
    cashierId: entity.cashierId,
    cashierName: entity.cashier.fullName,
    confirmedById: entity.confirmedById,
    confirmedByName: entity.confirmedBy?.fullName ?? null,
    confirmedAt: entity.confirmedAt ? entity.confirmedAt.toISOString() : null,
    note: entity.note,
    createdAt: entity.createdAt.toISOString(),
  };
}
