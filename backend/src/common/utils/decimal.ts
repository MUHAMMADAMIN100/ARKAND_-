import { Prisma } from '@prisma/client';

/** Prisma.Decimal → number (для DTO). Безопасно для денег/количеств в разумных пределах. */
export function decToNum(value: Prisma.Decimal | number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return Number(value.toString());
}

/** number → Prisma.Decimal (для записи). */
export function numToDec(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

/** Округление до 2 знаков (деньги). */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Округление до 3 знаков (количества). */
export function round3(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}
