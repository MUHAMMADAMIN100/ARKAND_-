import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type {
  CompleteInventoryInput,
  InventoryDto,
  Paginated,
  StartInventoryInput,
  SubmitCountsInput,
  WarehouseType,
} from '@sheben/shared';
import { AuditService, buildPaginated, decToNum, round2, round3, skipTake, StockService, TransactionHost } from '../../common';
import type { RequestUser } from '../../common';
import { toInventoryDto } from './inventory.mapper';
import { InventoryRepository } from './inventory.repository';
import type { InventoryFilter } from './inventory.filters';

@Injectable()
export class InventoryService {
  constructor(
    private readonly repo: InventoryRepository,
    private readonly txHost: TransactionHost,
    private readonly stock: StockService,
    private readonly audit: AuditService,
  ) {}

  async list(filter: InventoryFilter): Promise<Paginated<InventoryDto>> {
    const { skip, take } = skipTake(filter.page, filter.pageSize);
    const { items, total } = await this.repo.findMany({ status: filter.status }, skip, take);
    return buildPaginated(items.map(toInventoryDto), total, filter.page, filter.pageSize);
  }

  async getById(id: string): Promise<InventoryDto> {
    const inventory = await this.repo.findByIdOrThrow(id);
    return toInventoryDto(inventory);
  }

  /** Запуск инвентаризации (ИНВ-01, ИНВ-02): фиксирует systemQty на момент старта и блокирует склад/позиции. */
  async start(dto: StartInventoryInput, user: RequestUser): Promise<InventoryDto> {
    const warehouse = await this.repo.getWarehouseOrThrow(dto.warehouseId);

    const active = await this.repo.findActiveByWarehouse(warehouse.id);
    if (active) {
      throw new ConflictException('На этом складе уже идёт инвентаризация');
    }

    const partialProductIds = dto.scope === 'PARTIAL' ? [...new Set(dto.productIds ?? [])] : null;
    if (partialProductIds && partialProductIds.length === 0) {
      throw new BadRequestException('Для частичной инвентаризации выберите позиции');
    }
    if (partialProductIds) {
      const existingCount = await this.repo.countExistingProducts(partialProductIds);
      if (existingCount !== partialProductIds.length) {
        throw new BadRequestException('Один или несколько товаров не найдены');
      }
    }

    const stockMap = await this.repo.getStockQtyMap(warehouse.id, partialProductIds ?? undefined);
    const lines = partialProductIds
      ? partialProductIds.map((productId) => ({ productId, systemQty: stockMap.get(productId) ?? 0 }))
      : [...stockMap.entries()].map(([productId, systemQty]) => ({ productId, systemQty }));

    if (lines.length === 0) {
      throw new BadRequestException('Нет позиций для инвентаризации');
    }

    const inventory = await this.txHost.run(async () => {
      const created = await this.repo.createInventory({
        warehouseId: warehouse.id,
        scope: dto.scope,
        note: dto.note ?? null,
        startedById: user.id,
        lines,
      });
      await this.repo.addLock({
        inventoryId: created.id,
        warehouseType: warehouse.type,
        productIds: partialProductIds,
      });
      return created;
    });

    await this.audit.log({ userId: user.id, action: 'inventory.start', entity: 'Inventory', entityId: inventory.id });
    return toInventoryDto(inventory);
  }

  /** Ввод факта пересчёта (ИНВ-04): пересчитывает diffQty/diffAmount по каждой позиции. */
  async submitCounts(id: string, dto: SubmitCountsInput, user: RequestUser): Promise<InventoryDto> {
    await this.txHost.run(async () => {
      const inventory = await this.repo.findByIdOrThrow(id);
      if (inventory.status !== 'IN_PROGRESS') {
        throw new BadRequestException('Инвентаризация уже завершена или отменена');
      }

      const itemsById = new Map(inventory.items.map((item) => [item.id, item]));
      for (const count of dto.counts) {
        const item = itemsById.get(count.itemId);
        if (!item) {
          throw new BadRequestException('Позиция не относится к этой инвентаризации');
        }
        const diffQty = round3(count.factQty - decToNum(item.systemQty));
        const diffAmount = round2(diffQty * decToNum(item.product.price));
        await this.repo.updateItemCount(item.id, count.factQty, diffQty, diffAmount);
      }

      await this.repo.setCountedBy(id, user.id);
    });

    const full = await this.repo.findByIdOrThrow(id);
    await this.audit.log({ userId: user.id, action: 'inventory.count', entity: 'Inventory', entityId: id });
    return toInventoryDto(full);
  }

  /**
   * Завершение (ИНВ-06, ИНВ-07, ИНВ-08): для недостач требует объяснение и ответственного,
   * для каждого расхождения — корректирующее движение склада, затем закрывает инвентаризацию.
   */
  async complete(id: string, dto: CompleteInventoryInput, user: RequestUser): Promise<InventoryDto> {
    await this.txHost.run(async () => {
      const inventory = await this.repo.findByIdOrThrow(id);
      if (inventory.status !== 'IN_PROGRESS') {
        throw new BadRequestException('Инвентаризация уже завершена или отменена');
      }
      if (inventory.items.some((item) => item.factQty === null)) {
        throw new BadRequestException('Не все позиции пересчитаны');
      }

      const shortageByItem = new Map((dto.shortages ?? []).map((shortage) => [shortage.itemId, shortage]));
      const warehouseType = inventory.warehouse.type;

      for (const item of inventory.items) {
        const diffQty = decToNum(item.diffQty);
        if (diffQty === 0) continue;

        if (diffQty < 0) {
          const shortage = shortageByItem.get(item.id);
          if (!shortage) {
            throw new BadRequestException(`Укажите причину и ответственного за недостачу: «${item.product.name}»`);
          }
          await this.repo.setShortageInfo(item.id, shortage.explanation, shortage.responsibleId);
        }

        await this.stock.applyMovement({
          warehouseType,
          productId: item.productId,
          type: 'INVENTORY_ADJUST',
          qty: diffQty,
          byUserId: user.id,
          refType: 'inventory',
          refId: inventory.id,
        });
      }

      await this.repo.completeInventory(id);
      await this.repo.releaseLock(id);
    });

    const full = await this.repo.findByIdOrThrow(id);
    await this.audit.log({ userId: user.id, action: 'inventory.complete', entity: 'Inventory', entityId: id });
    return toInventoryDto(full);
  }

  /** Отмена инвентаризации без движений склада. */
  async cancel(id: string, user: RequestUser): Promise<InventoryDto> {
    await this.txHost.run(async () => {
      const inventory = await this.repo.findByIdOrThrow(id);
      if (inventory.status !== 'IN_PROGRESS') {
        throw new BadRequestException('Инвентаризация уже завершена или отменена');
      }
      await this.repo.cancelInventory(id);
      await this.repo.releaseLock(id);
    });

    const full = await this.repo.findByIdOrThrow(id);
    await this.audit.log({ userId: user.id, action: 'inventory.cancel', entity: 'Inventory', entityId: id });
    return toInventoryDto(full);
  }

  /**
   * ИНВ-03: заблокирована ли позиция активной инвентаризацией.
   * Другие модули не обязаны вызывать этот метод напрямую (кросс-доменные импорты
   * запрещены архитектурой) — при необходимости они читают Setting('inventory.lock')
   * через общий PrismaService.
   */
  async isLocked(warehouseType: WarehouseType, productId: string): Promise<boolean> {
    return this.repo.isLocked(warehouseType, productId);
  }
}
