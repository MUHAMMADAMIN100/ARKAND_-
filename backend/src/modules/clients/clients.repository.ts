import { Injectable } from '@nestjs/common';
import { Client, ClientType, Prisma } from '@prisma/client';
import { decToNum, skipTake, TransactionHost } from '../../common';

export interface ClientsListFilter {
  type?: ClientType;
  search?: string;
  page: number;
  pageSize: number;
}

/** Доступ к клиентам + балансу долга (debt_entries) через Prisma. */
@Injectable()
export class ClientsRepository {
  constructor(private readonly txHost: TransactionHost) {}

  private get db(): Prisma.TransactionClient {
    return this.txHost.tx as Prisma.TransactionClient;
  }

  async findMany(filter: ClientsListFilter): Promise<{ items: Client[]; total: number }> {
    const where = this.buildWhere(filter);
    const { skip, take } = skipTake(filter.page, filter.pageSize);

    const [items, total] = await Promise.all([
      this.db.client.findMany({ where, orderBy: [{ name: 'asc' }], skip, take }),
      this.db.client.count({ where }),
    ]);
    return { items, total };
  }

  async findById(id: string): Promise<Client | null> {
    return this.db.client.findUnique({ where: { id } });
  }

  async create(data: Prisma.ClientCreateInput): Promise<Client> {
    return this.db.client.create({ data });
  }

  async update(id: string, data: Prisma.ClientUpdateInput): Promise<Client> {
    return this.db.client.update({ where: { id }, data });
  }

  /** Баланс долга (SUM debt_entries.amount) сразу для нескольких клиентов — без N+1. */
  async getDebtBalances(clientIds: string[]): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (clientIds.length === 0) return result;

    const grouped = await this.db.debtEntry.groupBy({
      by: ['clientId'],
      where: { clientId: { in: clientIds } },
      _sum: { amount: true },
    });
    for (const row of grouped) {
      result.set(row.clientId, decToNum(row._sum.amount));
    }
    return result;
  }

  private buildWhere(filter: ClientsListFilter): Prisma.ClientWhereInput {
    const where: Prisma.ClientWhereInput = {};
    if (filter.type) where.type = filter.type;

    const search = filter.search?.trim();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }
    return where;
  }
}
