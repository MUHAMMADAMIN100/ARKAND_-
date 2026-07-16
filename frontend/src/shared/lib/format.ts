/** Форматирование денег в сомони. */
export function money(value: number | null | undefined): string {
  const n = value ?? 0;
  return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n) + ' смн';
}

/** Число с разделителями (количества). */
export function num(value: number | null | undefined, maxFrac = 3): string {
  const n = value ?? 0;
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: maxFrac }).format(n);
}

/** Количество с единицей измерения. */
export function qty(value: number | null | undefined, unit = 'м³'): string {
  return `${num(value)} ${unit}`;
}

const dtf = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
const dtfTime = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : dtf.format(d);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : dtfTime.format(d);
}

export function formatMonth(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(d);
}

/** Сегодняшняя дата в формате YYYY-MM-DD (для дефолтов форм). */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
