import { Injectable, NotFoundException } from '@nestjs/common';
import { Client, Prisma } from '@prisma/client';
import { PrismaService, TransactionHost, decToNum, round2, skipTake } from '../../common';

const DEBT_ENTRY_INCLUDE = {
  client: true,
  byUser: true,
} satisfies Prisma.DebtEntryInclude;

export type DebtEntryEntity = Prisma.DebtEntryGetPayload<{ include: typeof DEBT_ENTRY_INCLUDE }>;

export interface ClientDebtBalance {
  clientId: string;
  clientName: string;
  balance: number;
  lastEntryAt: Date | null;
}

/** Доступ к БД для реестра долгов между бизнесами холдинга (ХОЛ-30…33). */
@Injectable()
export class DebtRegistryRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly txHost: TransactionHost,
  ) {}

  private get db(): Prisma.TransactionClient {
    return this.txHost.tx as Prisma.TransactionClient;
  }

  /** Баланс по каждому INTERNAL-клиенту с ненулевым долгом: SUM(debt_entries.amount). */
  async listInternalBalances(): Promise<ClientDebtBalance[]> {
    const clients = await this.db.client.findMany({
      where: { type: 'INTERNAL' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    if (clients.length === 0) return [];

    const clientIds = clients.map((c) => c.id);
    const grouped = await this.db.debtEntry.groupBy({
      by: ['clientId'],
      where: { clientId: { in: clientIds } },
      _sum: { amount: true },
      _max: { createdAt: true },
    });
    const byClientId = new Map(grouped.map((g) => [g.clientId, g]));

    return clients
      .map((client) => {
        const group = byClientId.get(client.id);
        const balance = group?._sum.amount ? round2(decToNum(group._sum.amount)) : 0;
        return {
          clientId: client.id,
          clientName: client.name,
          balance,
          lastEntryAt: group?._max.createdAt ?? null,
        };
      })
      .filter((entry) => entry.balance !== 0);
  }

  async findClientOrThrow(clientId: string): Promise<Client> {
    const client = await this.db.client.findUnique({ where: { id: clientId } });
    if (!client) throw new NotFoundException('Клиент не найден');
    return client;
  }

  async findEntries(clientId: string, page: number, pageSize: number): Promise<[DebtEntryEntity[], number]> {
    const where: Prisma.DebtEntryWhereInput = { clientId };
    const { skip, take } = skipTake(page, pageSize);
    const [items, total] = await Promise.all([
      this.db.debtEntry.findMany({
        where,
        include: DEBT_ENTRY_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.db.debtEntry.count({ where }),
    ]);
    return [items, total];
  }

  /**
   * Последняя запись долга, созданная данным пользователем для клиента.
   * Используется сразу после DebtService.record() (в той же транзакции), чтобы вернуть DTO с реальным id.
   */
  async findLatestEntryForUser(clientId: string, byUserId: string): Promise<DebtEntryEntity> {
    const entry = await this.db.debtEntry.findFirst({
      where: { clientId, byUserId },
      include: DEBT_ENTRY_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    if (!entry) throw new NotFoundException('Не удалось найти созданную запись долга');
    return entry;
  }
}
