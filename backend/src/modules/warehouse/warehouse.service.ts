import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { StockMovementType, WarehouseType } from '@prisma/client';
import type { CursorPage, MovementFilter, StockItemDto, StockMovementDto, WarehouseDto } from '@sheben/shared';
import {
  AuditService,
  decToNum,
  decodeCursor,
  encodeCursor,
  round3,
  StockService,
  TransactionHost,
} from '../../common';
import type { RequestUser } from '../../common';
import { toStockItemDto, toStockMovementDto, toWarehouseDto } from './warehouse.mapper';
import { WarehouseRepository } from './warehouse.repository';

export interface StockFilter {
  warehouseId?: string;
  belowMin?: boolean;
}

export interface AdjustStockCommand {
  warehouseType: WarehouseType;
  productId: string;
  targetQty: number;
  comment: string;
}

/** Склады, остатки и движения. Ручная корректировка идёт только через общий StockService.applyMovement. */
@Injectable()
export class WarehouseService {
  constructor(
    private readonly repo: WarehouseRepository,
    private readonly stock: StockService,
    private readonly txHost: TransactionHost,
    private readonly audit: AuditService,
  ) {}

  async getStock(filter: StockFilter): Promise<StockItemDto[]> {
    const rows = await this.repo.findStockItems(filter.warehouseId);
    const items = rows.map(toStockItemDto);
    return filter.belowMin ? items.filter((item) => item.belowMin) : items;
  }

  async listWarehouses(): Promise<WarehouseDto[]> {
    const warehouses = await this.repo.findWarehouses();
    return warehouses.map(toWarehouseDto);
  }

  async getMovements(filter: MovementFilter): Promise<CursorPage<StockMovementDto>> {
    const cursor = decodeCursor(filter.cursor);
    const { items, hasMore } = await this.repo.findMovements({
      warehouseId: filter.warehouseId,
      productId: filter.productId,
      type: filter.type,
      from: filter.from,
      to: filter.to,
      cursor,
      limit: filter.limit,
    });

    const dtos = items.map(toStockMovementDto);
    const last = items.at(-1);
    const nextCursor = hasMore && last ? encodeCursor(last.createdAt, last.id) : null;
    return { items: dtos, nextCursor };
  }

  async adjustStock(user: RequestUser, dto: AdjustStockCommand): Promise<StockItemDto> {
    return this.txHost.run(async () => {
      const product = await this.repo.findProductById(dto.productId);
      if (!product) throw new NotFoundException('Товар не найден');

      if (product.kind !== dto.warehouseType) {
        throw new BadRequestException('Тип склада не соответствует типу товара');
      }

      const warehouse = await this.repo.findWarehouseByType(dto.warehouseType);
      if (!warehouse) throw new BadRequestException(`Склад ${dto.warehouseType} не сконфигурирован`);

      const currentQty = await this.stock.getStock(dto.warehouseType, dto.productId);
      const diff = round3(dto.targetQty - currentQty);

      if (diff !== 0) {
        await this.stock.applyMovement({
          warehouseType: dto.warehouseType,
          productId: dto.productId,
          type: StockMovementType.MANUAL_ADJUST,
          qty: diff,
          byUserId: user.id,
          comment: dto.comment,
          allowNegative: false,
        });
      }

      await this.audit.log({
        userId: user.id,
        action: 'warehouse.stock_adjust',
        entity: 'stock_item',
        entityId: dto.productId,
        payload: {
          warehouseType: dto.warehouseType,
          previousQty: currentQty,
          targetQty: dto.targetQty,
          comment: dto.comment,
        },
      });

      const item = await this.repo.findStockItem(warehouse.id, dto.productId);
      if (item) return toStockItemDto(item);

      // Позиция никогда не двигалась и разница оказалась нулевой — строки stock_items ещё нет.
      const minStock = product.minStock !== null ? decToNum(product.minStock) : null;
      return {
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        productId: product.id,
        productName: product.name,
        productKind: product.kind,
        unit: product.unit,
        quantity: dto.targetQty,
        minStock,
        belowMin: minStock !== null && dto.targetQty < minStock,
      };
    });
  }
}
