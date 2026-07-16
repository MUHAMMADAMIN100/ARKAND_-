import type { Warehouse } from '@prisma/client';
import type { StockItemDto, StockMovementDto, WarehouseDto } from '@sheben/shared';
import { decToNum } from '../../common';
import type { MovementWithRelations, StockItemWithRelations } from './warehouse.repository';

export function toWarehouseDto(warehouse: Warehouse): WarehouseDto {
  return { id: warehouse.id, name: warehouse.name, type: warehouse.type };
}

export function toStockItemDto(item: StockItemWithRelations): StockItemDto {
  const quantity = decToNum(item.quantity);
  const minStock = item.product.minStock !== null ? decToNum(item.product.minStock) : null;
  return {
    warehouseId: item.warehouseId,
    warehouseName: item.warehouse.name,
    productId: item.productId,
    productName: item.product.name,
    productKind: item.product.kind,
    unit: item.product.unit,
    quantity,
    minStock,
    belowMin: minStock !== null && quantity < minStock,
  };
}

export function toStockMovementDto(row: MovementWithRelations): StockMovementDto {
  return {
    id: row.id,
    warehouseId: row.warehouseId,
    warehouseName: row.warehouse.name,
    productId: row.productId,
    productName: row.product.name,
    unit: row.product.unit,
    type: row.type,
    qty: decToNum(row.qty),
    refType: row.refType,
    refId: row.refId,
    byUserId: row.byUserId,
    byUserName: row.byUser.fullName,
    comment: row.comment,
    createdAt: row.createdAt.toISOString(),
  };
}
