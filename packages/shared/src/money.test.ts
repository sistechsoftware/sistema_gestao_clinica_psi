import { describe, expect, it } from 'vitest';
import { addCents, formatBRL, MoneyError, splitCents, subtractCents } from './money.js';

describe('money (centavos inteiros)', () => {
  it('soma e subtrai sem erro de float', () => {
    expect(addCents(1050, 950)).toBe(2000);
    expect(subtractCents(2000, 950)).toBe(1050);
  });

  it('splitCents conserva o total exato', () => {
    const parts = splitCents(1000, 3);
    expect(parts).toEqual([334, 333, 333]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1000);
  });

  it('rejeita não-inteiros, negativos e overflow de coluna integer', () => {
    expect(() => assertSafe(1.5)).toThrow(MoneyError);
    expect(() => assertSafe(-1)).toThrow(MoneyError);
    expect(() => assertSafe(2 ** 31)).toThrow(MoneyError);
  });

  it('formatBRL apresenta em reais', () => {
    expect(formatBRL(123456)).toContain('1.234,56');
  });
});

function assertSafe(cents: number): void {
  // reexporta o guard para o teste ficar explícito
  addCents(cents, 0);
}
