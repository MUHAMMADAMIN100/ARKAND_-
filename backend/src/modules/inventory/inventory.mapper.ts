import type { InventoryDto, InventoryItemDto } from '@sheben/shared';
import { decToNum } from '../../common';
import type { InventoryWithRelations } from './inventory.repository';

function toInventoryItemDto(item: InventoryWithRelations['items'][number]): InventoryItemDto {
  return {
    id: item.id,
    productId: item.productId,
    productName: item.product.name,
    unit: item.product.unit,
    systemQty: decToNum(item.systemQty),
    factQty: item.factQty !== null ? decToNum(item.factQty) : null,
    diffQty: item.diffQty !== null ? decToNum(item.diffQty) : null,
    diffAmount: item.diffAmount !== null ? decToNum(item.diffAmount) : null,
    explanation: item.explanation,
    responsibleId: item.responsibleId,
    responsibleName: item.responsible?.fullName ?? null,
  };
}

/** Inventory (Prisma, + связи) -> InventoryDto. */
export function toInventoryDto(inventory: InventoryWithRelations): InventoryDto {
  return {
    id: inventory.id,
    number: inventory.number,
    warehouseId: inventory.warehouseId,
    warehouseName: inventory.warehouse.name,
    scope: inventory.scope,
    status: inventory.status,
    items: inventory.items.map(toInventoryItemDto),
    startedById: inventory.startedById,
    startedByName: inventory.startedBy.fullName,
    countedById: inventory.countedById,
    countedByName: inventory.countedBy?.fullName ?? null,
    note: inventory.note,
    startedAt: inventory.startedAt.toISOString(),
    completedAt: inventory.completedAt ? inventory.completedAt.toISOString() : null,
  };
}
