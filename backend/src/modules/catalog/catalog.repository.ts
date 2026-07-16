import { Injectable } from '@nestjs/common';
import { Prisma, Product, ProductKind } from '@prisma/client';
import { decToNum, TransactionHost } from '../../common';

export interface ProductsListFilter {
  kind?: ProductKind;
  /** true — отдать все (включая неактивные); по умолчанию — только активные. */
  all?: boolean;
}

interface ProductStockKey {
  id: string;
  kind: ProductKind;
}

/** Доступ к каталогу продукции + остаткам (stock_items) через Prisma. */
@Injectable()
export class CatalogRepository {
  constructor(private readonly txHost: TransactionHost) {}

  private get db(): Prisma.TransactionClient {
    return this.txHost.tx as Prisma.TransactionClient;
  }

  async findMany(filter: ProductsListFilter): Promise<Product[]> {
    const where: Prisma.ProductWhereInput = {};
    if (filter.kind) where.kind = filter.kind;
    if (!filter.all) where.isActive = true;

    return this.db.product.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findById(id: string): Promise<Product | null> {
    return this.db.product.findUnique({ where: { id } });
  }

  async create(data: Prisma.ProductCreateInput): Promise<Product> {
    return this.db.product.create({ data });
  }

  async update(id: string, data: Prisma.ProductUpdateInput): Promise<Product> {
    return this.db.product.update({ where: { id }, data });
  }

  /**
   * Текущий остаток для набора продукций: RAW → склад RAW, FINISHED → склад FINISHED.
   * Один findMany по складам + один findMany по stock_items — без N+1 независимо от количества продукций.
   */
  async getStockByProducts(products: ProductStockKey[]): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (products.length === 0) return result;

    const warehouses = await this.db.warehouse.findMany();
    const warehouseIdByType = new Map(warehouses.map((w) => [w.type, w.id]));

    const productIds = products.map((p) => p.id);
    const stockItems = await this.db.stockItem.findMany({
      where: { productId: { in: productIds } },
      select: { productId: true, warehouseId: true, quantity: true },
    });

    const quantityByWarehouseAndProduct = new Map<string, Prisma.Decimal>();
    for (const item of stockItems) {
      quantityByWarehouseAndProduct.set(`${item.warehouseId}:${item.productId}`, item.quantity);
    }

    for (const product of products) {
      const warehouseId = warehouseIdByType.get(product.kind);
      const qty = warehouseId ? quantityByWarehouseAndProduct.get(`${warehouseId}:${product.id}`) : undefined;
      result.set(product.id, qty ? decToNum(qty) : 0);
    }
    return result;
  }
}
