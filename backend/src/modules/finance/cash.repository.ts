import { Injectable, NotFoundException } from '@nestjs/common';
import { CashCategory, CashDirection, CashStatus, PaymentMethod, Prisma } from '@prisma/client';
import { PrismaService, TransactionHost, skipTake } from '../../common';

const CASH_TRANSACTION_INCLUDE = {
  client: true,
  order: true,
  cashier: true,
  confirmedBy: true,
} satisfies Prisma.CashTransactionInclude;

export type CashTransactionEntity = Prisma.CashTransactionGetPayload<{ include: typeof CASH_TRANSACTION_INCLUDE }>;

export interface CashListFilter {
  direction?: CashDirection;
  status?: CashStatus;
  category?: CashCategory;
  from?: string;
  to?: string;
  /** Проставляется сервисом по ABAC: кассир видит только свои операции. */
  cashierId?: string;
  page: number;
  pageSize: number;
}

export interface CreateCashTransactionData {
  direction: CashDirection;
  amount: Prisma.Decimal;
  method: PaymentMethod;
  category: CashCategory;
  date: Date;
  clientId: string | null;
  orderId: string | null;
  cashierId: string;
  note: string | null;
}

export interface UpdateCashDecisionData {
  status: CashStatus;
  confirmedById: string;
  confirmedAt: Date;
  note: string | null;
}

/** Доступ к БД для кассовых операций (ЩЕБ-60, ЩЕБ-61). */
@Injectable()
export class CashRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly txHost: TransactionHost,
  ) {}

  private get db(): Prisma.TransactionClient {
    return this.txHost.tx as Prisma.TransactionClient;
  }

  async findMany(filter: CashListFilter): Promise<[CashTransactionEntity[], number]> {
    const where = this.buildWhere(filter);
    const { skip, take } = skipTake(filter.page, filter.pageSize);
    const [items, total] = await Promise.all([
      this.db.cashTransaction.findMany({
        where,
        include: CASH_TRANSACTION_INCLUDE,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip,
        take,
      }),
      this.db.cashTransaction.count({ where }),
    ]);
    return [items, total];
  }

  async findByIdOrThrow(id: string): Promise<CashTransactionEntity> {
    const entity = await this.db.cashTransaction.findUnique({ where: { id }, include: CASH_TRANSACTION_INCLUDE });
    if (!entity) throw new NotFoundException('Кассовая операция не найдена');
    return entity;
  }

  async create(data: CreateCashTransactionData): Promise<CashTransactionEntity> {
    return this.db.cashTransaction.create({
      data: {
        direction: data.direction,
        amount: data.amount,
        method: data.method,
        category: data.category,
        status: 'PENDING',
        date: data.date,
        clientId: data.clientId,
        orderId: data.orderId,
        cashierId: data.cashierId,
        note: data.note,
      },
      include: CASH_TRANSACTION_INCLUDE,
    });
  }

  async updateDecision(id: string, data: UpdateCashDecisionData): Promise<CashTransactionEntity> {
    return this.db.cashTransaction.update({ where: { id }, data, include: CASH_TRANSACTION_INCLUDE });
  }

  private buildWhere(filter: CashListFilter): Prisma.CashTransactionWhereInput {
    const where: Prisma.CashTransactionWhereInput = {};
    if (filter.direction) where.direction = filter.direction;
    if (filter.status) where.status = filter.status;
    if (filter.category) where.category = filter.category;
    if (filter.cashierId) where.cashierId = filter.cashierId;
    if (filter.from || filter.to) {
      where.date = {
        ...(filter.from ? { gte: new Date(filter.from) } : {}),
        ...(filter.to ? { lte: new Date(filter.to) } : {}),
      };
    }
    return where;
  }
}
