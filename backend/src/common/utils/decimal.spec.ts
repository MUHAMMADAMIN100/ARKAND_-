import { decToNum, round2, round3 } from './decimal';

describe('decimal utils', () => {
  it('decToNum обрабатывает null/undefined как 0', () => {
    expect(decToNum(null)).toBe(0);
    expect(decToNum(undefined)).toBe(0);
    expect(decToNum(42.5)).toBe(42.5);
    expect(decToNum('13.37')).toBe(13.37);
  });

  it('round2/round3 округляют корректно', () => {
    expect(round2(10.005)).toBe(10.01);
    expect(round2(10.004)).toBe(10);
    expect(round3(1.23456)).toBe(1.235);
  });
});
