import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, StockMovementType, WarehouseType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionHost } from '../prisma/transaction';
import { numToDec } from '../utils/decimal';

export interface ApplyMovementInput {
  warehouseType: WarehouseType;
  productId: string;
  type: StockMovementType;
  /** Подписанное количество: приход > 0, расход < 0. */
  qty: number;
  byUserId: string;
  refType?: string;
  refId?: string;
  comment?: string;
  /** Запрещать уход остатка в минус (по умолчанию true). */
  allowNegative?: boolean;
}

/**
 * Общий сервис движения склада. Любое изменение остатка идёт ТОЛЬКО через applyMovement:
 * атомарно пишет движение (append-only) и обновляет агрегат stock_items.
 * Вызывается из production/shipments/procurement/inventory в рамках их транзакций.
 */
@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly txHost: TransactionHost,
  ) {}

  private get db(): Prisma.TransactionClient {
    return this.txHost.tx as Prisma.TransactionClient;
  }

  async getWarehouseId(type: WarehouseType): Promise<string> {
    const wh = await this.db.warehouse.findUnique({ where: { type } });
    if (!wh) throw new BadRequestException(`Склад ${type} не сконфигурирован`);
    return wh.id;
  }

  async applyMovement(input: ApplyMovementInput): Promise<void> {
    const { warehouseType, productId, type, qty, byUserId, allowNegative = true } = input;
    if (qty === 0) return;

    await this.txHost.run(async () => {
      const warehouseId = await this.getWarehouseId(warehouseType);

      // ИНВ-03: во время активной инвентаризации движения по позиции запрещены.
      // Единая точка контроля — здесь через неё проходят ВСЕ изменения остатков.
      await this.assertNotLockedByInventory(warehouseType, productId);

      // Атомарный инкремент: `UPDATE ... SET quantity = quantity + qty` блокирует строку,
      // поэтому конкурентные движения сериализуются без потери обновлений (гонка read-modify-write).
      const item = await this.db.stockItem.upsert({
        where: { warehouseId_productId: { warehouseId, productId } },
        create: { warehouseId, productId, quantity: numToDec(qty) },
        update: { quantity: { increment: numToDec(qty) } },
      });

      // Проверка неотрицательного остатка — после инкремента (строка уже под блокировкой транзакции).
      if (!allowNegative && Number(item.quantity.toString()) < 0) {
        throw new BadRequestException('Недостаточно остатка на складе');
      }

      await this.db.stockMovement.create({
        data: {
          warehouseId,
          productId,
          type,
          qty: numToDec(qty),
          byUserId,
          refType: input.refType ?? null,
          refId: input.refId ?? null,
          comment: input.comment ?? null,
        },
      });
    });
  }

  /** Проверка блокировки позиции активной инвентаризацией (ИНВ-03). Читает Setting напрямую. */
  private async assertNotLockedByInventory(warehouseType: WarehouseType, productId: string): Promise<void> {
    const setting = await this.db.setting.findUnique({ where: { key: 'inventory.lock' } });
    if (!setting) return;
    const value = setting.value as unknown as {
      locks?: { warehouseType: WarehouseType; productIds: string[] | null }[];
    };
    const locked = (value.locks ?? []).some(
      (lock) => lock.warehouseType === warehouseType && (lock.productIds === null || lock.productIds.includes(productId)),
    );
    if (locked) {
      throw new BadRequestException('Идёт инвентаризация по этой позиции — движения временно заблокированы');
    }
  }

  async getStock(warehouseType: WarehouseType, productId: string): Promise<number> {
    const warehouseId = await this.getWarehouseId(warehouseType);
    const item = await this.db.stockItem.findUnique({
      where: { warehouseId_productId: { warehouseId, productId } },
    });
    return item ? Number(item.quantity.toString()) : 0;
  }
}
