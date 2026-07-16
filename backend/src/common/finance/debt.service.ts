import { Injectable } from '@nestjs/common';
import { Prisma, DebtEntryType } from '@prisma/client';
import { TransactionHost } from '../prisma/transaction';
import { numToDec } from '../utils/decimal';

export interface RecordDebtInput {
  clientId: string;
  type: DebtEntryType;
  /** Знаковая сумма: SHIPMENT>0 (нам должны больше), REPAYMENT/OFFSET<0. */
  amount: number;
  date: Date;
  byUserId: string;
  refType?: string;
  refId?: string;
  note?: string;
}

/**
 * Фасад долгов между бизнесами (ХОЛ-30…33). Глобальный: используется shipments (автодолг
 * при бартере) и finance (погашение/взаимозачёт/реестр). Баланс = SUM(amount) по клиенту.
 */
@Injectable()
export class DebtService {
  constructor(private readonly txHost: TransactionHost) {}

  private get db(): Prisma.TransactionClient {
    return this.txHost.tx as Prisma.TransactionClient;
  }

  async record(input: RecordDebtInput): Promise<void> {
    await this.db.debtEntry.create({
      data: {
        clientId: input.clientId,
        type: input.type,
        amount: numToDec(input.amount),
        date: input.date,
        byUserId: input.byUserId,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
        note: input.note ?? null,
      },
    });
  }

  async getBalance(clientId: string): Promise<number> {
    const agg = await this.db.debtEntry.aggregate({
      where: { clientId },
      _sum: { amount: true },
    });
    return agg._sum.amount ? Number(agg._sum.amount.toString()) : 0;
  }
}
