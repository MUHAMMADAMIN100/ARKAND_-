import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

/**
 * Сквозной транзакционный клиент через AsyncLocalStorage.
 * Репозитории вызывают txHost.tx — получают либо активную транзакцию, либо базовый клиент.
 * Это позволяет нескольким сервисам работать в одной транзакции без передачи tx-клиента в аргументах.
 */
type TxClient = Prisma.TransactionClient;

@Injectable()
export class TransactionHost {
  private readonly als = new AsyncLocalStorage<TxClient>();

  constructor(private readonly prisma: PrismaService) {}

  /** Активный клиент: транзакция (если внутри run) или базовый Prisma. */
  get tx(): TxClient | PrismaService {
    return this.als.getStore() ?? this.prisma;
  }

  /** Выполнить callback в транзакции. Вложенные вызовы переиспользуют внешнюю транзакцию. */
  async run<T>(fn: () => Promise<T>, options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): Promise<T> {
    const existing = this.als.getStore();
    if (existing) {
      return fn();
    }
    return this.prisma.$transaction(
      (txClient) => this.als.run(txClient as TxClient, fn),
      options,
    );
  }
}
