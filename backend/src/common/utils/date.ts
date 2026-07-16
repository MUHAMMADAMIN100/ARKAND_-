/**
 * Границы суток в UTC для строковой даты (YYYY-MM-DD).
 * Считаем в UTC, чтобы фильтры «по дату» давали одинаковый результат независимо от
 * часового пояса процесса (и совпадали с отчётами, которые тоже считают в UTC).
 */

/** Начало суток (00:00:00.000 UTC) указанной даты. */
export function startOfDayUtc(dateStr: string): Date {
  const d = new Date(dateStr);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

/** Конец суток (23:59:59.999 UTC) указанной даты — включительно для верхней границы. */
export function endOfDayUtc(dateStr: string): Date {
  const d = new Date(dateStr);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}
