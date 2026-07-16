import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, ProductKind, ShiftStatus } from '@prisma/client';
import { TransactionHost } from '../../common';

/** Смена + оператор + выпуск по фракциям (с товаром) — без N+1. */
const shiftInclude = {
  operator: true,
  outputs: {
    include: { product: true },
    orderBy: { product: { sortOrder: 'asc' } },
  },
} satisfies Prisma.ProductionShiftInclude;

export type ShiftWithRelations = Prisma.ProductionShiftGetPayload<{ include: typeof shiftInclude }>;

export interface ShiftDateRange {
  from?: string;
  to?: string;
}

export interface OpenShiftData {
  date: Date;
  shiftNumber: number;
  operatorId: string;
  note: string | null;
}

@Injectable()
export class ProductionRepository {
  constructor(private readonly txHost: TransactionHost) {}

  private get db(): Prisma.TransactionClient {
    return this.txHost.tx as Prisma.TransactionClient;
  }

  private buildWhere(filter: ShiftDateRange): Prisma.ProductionShiftWhereInput {
    if (!filter.from && !filter.to) return {};
    return {
      date: {
        ...(filter.from ? { gte: new Date(filter.from) } : {}),
        ...(filter.to ? { lte: new Date(filter.to) } : {}),
      },
    };
  }

  async findMany(
    filter: ShiftDateRange,
    skip: number,
    take: number,
  ): Promise<{ items: ShiftWithRelations[]; total: number }> {
    const where = this.buildWhere(filter);
    const [items, total] = await Promise.all([
      this.db.productionShift.findMany({
        where,
        include: shiftInclude,
        orderBy: [{ date: 'desc' }, { shiftNumber: 'desc' }],
        skip,
        take,
      }),
      this.db.productionShift.count({ where }),
    ]);
    return { items, total };
  }

  findById(id: string): Promise<ShiftWithRelations | null> {
    return this.db.productionShift.findUnique({ where: { id }, include: shiftInclude });
  }

  findStatus(id: string): Promise<{ id: string; status: ShiftStatus } | null> {
    return this.db.productionShift.findUnique({ where: { id }, select: { id: true, status: true } });
  }

  async create(data: OpenShiftData): Promise<ShiftWithRelations> {
    try {
      return await this.db.productionShift.create({ data, include: shiftInclude });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Смена на эту дату уже открыта');
      }
      throw error;
    }
  }

  findOutput(shiftId: string, productId: string): Promise<{ quantity: Prisma.Decimal } | null> {
    return this.db.productionOutput.findUnique({
      where: { shiftId_productId: { shiftId, productId } },
      select: { quantity: true },
    });
  }

  async upsertOutput(shiftId: string, productId: string, quantity: Prisma.Decimal): Promise<void> {
    await this.db.productionOutput.upsert({
      where: { shiftId_productId: { shiftId, productId } },
      create: { shiftId, productId, quantity },
      update: { quantity },
    });
  }

  async incrementRawConsumed(id: string, amount: Prisma.Decimal): Promise<void> {
    await this.db.productionShift.update({ where: { id }, data: { rawConsumed: { increment: amount } } });
  }

  async close(id: string, note: string | undefined): Promise<void> {
    await this.db.productionShift.update({
      where: { id },
      data: {
        status: ShiftStatus.CLOSED,
        closedAt: new Date(),
        ...(note !== undefined ? { note } : {}),
      },
    });
  }

  /** Единственная сырьевая позиция (горная масса) — источник для списания RAW_CONSUME. */
  findPrimaryRawProduct(): Promise<{ id: string } | null> {
    return this.db.product.findFirst({
      where: { kind: 'RAW' },
      orderBy: { sortOrder: 'asc' },
      select: { id: true },
    });
  }

  /** Вид товара (RAW/FINISHED) по набору id — для проверки, что выпуск указан по продукции. */
  async findProductKinds(ids: string[]): Promise<Map<string, ProductKind>> {
    const map = new Map<string, ProductKind>();
    if (ids.length === 0) return map;
    const rows = await this.db.product.findMany({ where: { id: { in: ids } }, select: { id: true, kind: true } });
    for (const row of rows) map.set(row.id, row.kind);
    return map;
  }
}
