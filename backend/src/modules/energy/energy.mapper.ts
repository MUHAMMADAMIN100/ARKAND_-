import type { ElectricityLog } from '@prisma/client';
import type { ElectricityLogDto } from '@sheben/shared';
import { decToNum } from '../../common';

/** Ключ месяца 'YYYY-MM' — используется для сопоставления с выпуском продукции. */
export function toMonthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export type ElectricityLogWithRelations = ElectricityLog & { byUser: { fullName: string } };

export function toElectricityLogDto(log: ElectricityLogWithRelations, monthOutput: number): ElectricityLogDto {
  return {
    id: log.id,
    month: toDateOnly(log.month),
    kwh: decToNum(log.kwh),
    cost: decToNum(log.cost),
    note: log.note,
    byUserId: log.byUserId,
    byUserName: log.byUser.fullName,
    monthOutput,
    createdAt: log.createdAt.toISOString(),
  };
}
