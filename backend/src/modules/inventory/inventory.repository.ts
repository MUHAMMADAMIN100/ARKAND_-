import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { InventoryScope, InventoryStatus, WarehouseType } from '@sheben/shared';
import { decToNum, numToDec, TransactionHost } from '../../common';

/** Инвентаризация вместе со складом, инициатором, счётчиком и позициями (+товар/ответственный по каждой). */
const inventoryInclude = {
  warehouse: true,
  startedBy: true,
  countedBy: true,
  items: {
    include: { product: true, responsible: true },
    orderBy: { product: { name: 'asc' } },
  },
} satisfies Prisma.InventoryInclude;

export type InventoryWithRelations = Prisma.InventoryGetPayload<{ include: typeof inventoryInclude }>;

export interface InventoryStatusFilter {
  status?: InventoryStatus;
}

export interface InventoryLine {
  productId: string;
  systemQty: number;
}

export interface CreateInventoryData {
  warehouseId: string;
  scope: InventoryScope;
  note: string | null;
  startedById: string;
  lines: InventoryLine[];
}

/** Активная блокировка склада на время инвентаризации (упрощённая реализация ИНВ-03). */
export interface InventoryLockEntry {
  inventoryId: string;
  warehouseType: WarehouseType;
  /** null — блокировка всего склада (FULL); иначе — только эти товары (PARTIAL). */
  productIds: string[] | null;
}

const LOCK_SETTING_KEY = 'inventory.lock';

/** Доступ к инвентаризациям + флагу блокировки склада через Prisma. */
@Injectable()
export class InventoryRepository {
  constructor(private readonly txHost: TransactionHost) {}

  private get db(): Prisma.TransactionClient {
    return this.txHost.tx as Prisma.TransactionClient;
  }

  async findMany(
    filter: InventoryStatusFilter,
    skip: number,
    take: number,
  ): Promise<{ items: InventoryWithRelations[]; total: number }> {
    const where: Prisma.InventoryWhereInput = filter.status ? { status: filter.status } : {};
    const [items, total] = await Promise.all([
      this.db.inventory.findMany({ where, include: inventoryInclude, orderBy: { number: 'desc' }, skip, take }),
      this.db.inventory.count({ where }),
    ]);
    return { items, total };
  }

  async findByIdOrThrow(id: string): Promise<InventoryWithRelations> {
    const inventory = await this.db.inventory.findUnique({ where: { id }, include: inventoryInclude });
    if (!inventory) throw new NotFoundException('Инвентаризация не найдена');
    return inventory;
  }

  async getWarehouseOrThrow(warehouseId: string) {
    const warehouse = await this.db.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) throw new NotFoundException('Склад не найден');
    return warehouse;
  }

  async findActiveByWarehouse(warehouseId: string) {
    return this.db.inventory.findFirst({ where: { warehouseId, status: 'IN_PROGRESS' } });
  }

  /** Остатки склада: если productIds не заданы — все позиции склада (для FULL); иначе — только выбранные. */
  async getStockQtyMap(warehouseId: string, productIds?: string[]): Promise<Map<string, number>> {
    const where: Prisma.StockItemWhereInput = {
      warehouseId,
      ...(productIds ? { productId: { in: productIds } } : {}),
    };
    const items = await this.db.stockItem.findMany({ where, select: { productId: true, quantity: true } });
    return new Map(items.map((item) => [item.productId, decToNum(item.quantity)]));
  }

  async countExistingProducts(productIds: string[]): Promise<number> {
    if (productIds.length === 0) return 0;
    return this.db.product.count({ where: { id: { in: productIds } } });
  }

  async createInventory(data: CreateInventoryData): Promise<InventoryWithRelations> {
    return this.db.inventory.create({
      data: {
        warehouseId: data.warehouseId,
        scope: data.scope,
        note: data.note,
        startedById: data.startedById,
        items: {
          create: data.lines.map((line) => ({
            productId: line.productId,
            systemQty: numToDec(line.systemQty),
          })),
        },
      },
      include: inventoryInclude,
    });
  }

  async updateItemCount(itemId: string, factQty: number, diffQty: number, diffAmount: number): Promise<void> {
    await this.db.inventoryItem.update({
      where: { id: itemId },
      data: { factQty: numToDec(factQty), diffQty: numToDec(diffQty), diffAmount: numToDec(diffAmount) },
    });
  }

  async setCountedBy(inventoryId: string, userId: string): Promise<void> {
    await this.db.inventory.update({ where: { id: inventoryId }, data: { countedById: userId } });
  }

  async setShortageInfo(itemId: string, explanation: string, responsibleId: string): Promise<void> {
    await this.db.inventoryItem.update({ where: { id: itemId }, data: { explanation, responsibleId } });
  }

  async completeInventory(id: string): Promise<void> {
    await this.db.inventory.update({ where: { id }, data: { status: 'COMPLETED', completedAt: new Date() } });
  }

  async cancelInventory(id: string): Promise<void> {
    await this.db.inventory.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  // ---- Блокировка склада на время инвентаризации (ИНВ-03, упрощённая реализация) ----
  // Флаг активной блокировки хранится в Setting('inventory.lock'), а не проверяется
  // автоматически другими модулями — кросс-доменные импорты сервисов запрещены
  // архитектурой (ESLint boundaries). Если другому модулю понадобится узнать, что
  // позиция сейчас заблокирована инвентаризацией, он может напрямую прочитать эту
  // запись через общий PrismaService (это разрешено конвенциями проекта — чтение
  // чужих данных напрямую через Prisma, без импорта чужого сервиса). Единственная
  // гарантия, которую обеспечивает сам этот модуль, — запрет повторного запуска
  // инвентаризации по складу, где уже идёт другая (см. findActiveByWarehouse).

  async addLock(entry: InventoryLockEntry): Promise<void> {
    const locks = await this.readLocks();
    locks.push(entry);
    await this.writeLocks(locks);
  }

  async releaseLock(inventoryId: string): Promise<void> {
    const locks = await this.readLocks();
    await this.writeLocks(locks.filter((lock) => lock.inventoryId !== inventoryId));
  }

  async isLocked(warehouseType: WarehouseType, productId: string): Promise<boolean> {
    const locks = await this.readLocks();
    return locks.some(
      (lock) => lock.warehouseType === warehouseType && (lock.productIds === null || lock.productIds.includes(productId)),
    );
  }

  private async readLocks(): Promise<InventoryLockEntry[]> {
    const setting = await this.db.setting.findUnique({ where: { key: LOCK_SETTING_KEY } });
    if (!setting) return [];
    const value = setting.value as unknown as { locks?: InventoryLockEntry[] };
    return value.locks ?? [];
  }

  private async writeLocks(locks: InventoryLockEntry[]): Promise<void> {
    const value = { locks } as unknown as Prisma.InputJsonValue;
    await this.db.setting.upsert({
      where: { key: LOCK_SETTING_KEY },
      create: { key: LOCK_SETTING_KEY, value },
      update: { value },
    });
  }
}
