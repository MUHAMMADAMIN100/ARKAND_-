import { Injectable } from '@nestjs/common';
import { Prisma, StockMovementType, WarehouseType } from '@prisma/client';
import { endOfDayUtc, TransactionHost } from '../../common';

/** StockItem + название склада и товара (для StockItemDto без N+1). */
const stockItemInclude = {
  warehouse: true,
  product: true,
} satisfies Prisma.StockItemInclude;

export type StockItemWithRelations = Prisma.StockItemGetPayload<{ include: typeof stockItemInclude }>;

/** StockMovement + название склада, товара и автора (для StockMovementDto без N+1). */
const movementInclude = {
  warehouse: true,
  product: true,
  byUser: true,
} satisfies Prisma.StockMovementInclude;

export type MovementWithRelations = Prisma.StockMovementGetPayload<{ include: typeof movementInclude }>;

export interface MovementQueryFilter {
  warehouseId?: string;
  productId?: string;
  type?: StockMovementType;
  from?: string;
  to?: string;
  cursor: { createdAt: Date; id: string } | null;
  limit: number;
}


@Injectable()
export class WarehouseRepository {
  constructor(private readonly txHost: TransactionHost) {}

  private get db(): Prisma.TransactionClient {
    return this.txHost.tx as Prisma.TransactionClient;
  }

  findWarehouses() {
    return this.db.warehouse.findMany({ orderBy: { type: 'asc' } });
  }

  findWarehouseByType(type: WarehouseType) {
    return this.db.warehouse.findUnique({ where: { type } });
  }

  findProductById(id: string) {
    return this.db.product.findUnique({ where: { id } });
  }

  findStockItems(warehouseId?: string): Promise<StockItemWithRelations[]> {
    return this.db.stockItem.findMany({
      where: warehouseId ? { warehouseId } : undefined,
      include: stockItemInclude,
      orderBy: [{ warehouse: { type: 'asc' } }, { product: { sortOrder: 'asc' } }],
    });
  }

  findStockItem(warehouseId: string, productId: string): Promise<StockItemWithRelations | null> {
    return this.db.stockItem.findUnique({
      where: { warehouseId_productId: { warehouseId, productId } },
      include: stockItemInclude,
    });
  }

  private buildWhere(filter: MovementQueryFilter): Prisma.StockMovementWhereInput {
    const where: Prisma.StockMovementWhereInput = {};
    if (filter.warehouseId) where.warehouseId = filter.warehouseId;
    if (filter.productId) where.productId = filter.productId;
    if (filter.type) where.type = filter.type;
    if (filter.from || filter.to) {
      where.createdAt = {
        ...(filter.from ? { gte: new Date(filter.from) } : {}),
        ...(filter.to ? { lte: endOfDayUtc(filter.to) } : {}),
      };
    }
    return where;
  }

  async findMovements(filter: MovementQueryFilter): Promise<{ items: MovementWithRelations[]; hasMore: boolean }> {
    const baseWhere = this.buildWhere(filter);
    const where: Prisma.StockMovementWhereInput = filter.cursor
      ? {
          AND: [
            baseWhere,
            {
              OR: [
                { createdAt: { lt: filter.cursor.createdAt } },
                { createdAt: filter.cursor.createdAt, id: { lt: filter.cursor.id } },
              ],
            },
          ],
        }
      : baseWhere;

    const rows = await this.db.stockMovement.findMany({
      where,
      include: movementInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filter.limit + 1,
    });

    const hasMore = rows.length > filter.limit;
    return { items: hasMore ? rows.slice(0, filter.limit) : rows, hasMore };
  }
}
