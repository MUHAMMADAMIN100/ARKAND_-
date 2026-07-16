import type { OwnerApprovalDto, PurchaseRequestDto } from '@sheben/shared';
import { decToNum } from '../../common';
import type { OwnerApprovalEntity, PurchaseRequestEntity } from './procurement.repository';

export function toOwnerApprovalDto(entity: OwnerApprovalEntity): OwnerApprovalDto {
  return {
    id: entity.id,
    ownerId: entity.ownerId,
    ownerName: entity.owner.fullName,
    decision: entity.decision,
    note: entity.note,
    decidedAt: entity.decidedAt ? entity.decidedAt.toISOString() : null,
  };
}

export function toPurchaseRequestDto(entity: PurchaseRequestEntity): PurchaseRequestDto {
  return {
    id: entity.id,
    number: entity.number,
    title: entity.title,
    productId: entity.productId,
    productName: entity.product?.name ?? null,
    quantity: entity.quantity ? decToNum(entity.quantity) : null,
    unit: entity.unit,
    estimatedCost: entity.estimatedCost ? decToNum(entity.estimatedCost) : null,
    actualCost: entity.actualCost ? decToNum(entity.actualCost) : null,
    supplierName: entity.supplierName,
    status: entity.status,
    isLarge: entity.isLarge,
    isAuto: entity.isAuto,
    approvals: entity.approvals.map(toOwnerApprovalDto),
    note: entity.note,
    createdById: entity.createdById,
    createdByName: entity.createdBy.fullName,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}
