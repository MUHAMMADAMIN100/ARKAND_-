import { describe, expect, it } from 'vitest';
import { money, num, formatDate, todayISO } from './format';

describe('format', () => {
  it('money добавляет валюту', () => {
    expect(money(1000)).toContain('смн');
    expect(money(null)).toContain('0');
  });

  it('num форматирует количества', () => {
    expect(num(1234.5)).toContain('1');
    expect(num(null)).toBe('0');
  });

  it('formatDate возвращает прочерк на пустом', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate('не-дата')).toBe('—');
  });

  it('todayISO даёт YYYY-MM-DD', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
