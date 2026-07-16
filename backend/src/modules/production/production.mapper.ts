import type { ProductionShiftDto, ShiftOutputDto } from '@sheben/shared';
import { decToNum, round3 } from '../../common';
import type { ShiftWithRelations } from './production.repository';

export function toShiftDto(shift: ShiftWithRelations): ProductionShiftDto {
  const outputs: ShiftOutputDto[] = shift.outputs.map((output) => ({
    id: output.id,
    productId: output.productId,
    productName: output.product.name,
    unit: output.product.unit,
    quantity: decToNum(output.quantity),
  }));
  const totalOutput = round3(outputs.reduce((sum, item) => sum + item.quantity, 0));

  return {
    id: shift.id,
    date: shift.date.toISOString().slice(0, 10),
    shiftNumber: shift.shiftNumber,
    status: shift.status,
    operatorId: shift.operatorId,
    operatorName: shift.operator.fullName,
    rawConsumed: decToNum(shift.rawConsumed),
    totalOutput,
    outputs,
    note: shift.note,
    closedAt: shift.closedAt ? shift.closedAt.toISOString() : null,
    createdAt: shift.createdAt.toISOString(),
  };
}
