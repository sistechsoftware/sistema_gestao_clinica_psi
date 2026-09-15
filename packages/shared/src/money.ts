// ============================================================================
// Dinheiro — inteiros em centavos (doc 02 §5; §18). Nada de float.
// ============================================================================

const MAX_CENTS = 2 ** 31 - 1; // coluna integer no PostgreSQL

export class MoneyError extends Error {}

export function assertCents(cents: number, context = 'value'): void {
  if (!Number.isSafeInteger(cents)) {
    throw new MoneyError(`${context} must be a safe integer (cents), got: ${cents}`);
  }
  if (cents < 0) {
    throw new MoneyError(`${context} must be non-negative, got: ${cents}`);
  }
  if (cents > MAX_CENTS) {
    throw new MoneyError(`${context} exceeds integer column limit (${MAX_CENTS})`);
  }
}

/** soma de valores em centavos com verificação de overflow */
export function addCents(a: number, b: number): number {
  assertCents(a, 'a');
  assertCents(b, 'b');
  const sum = a + b;
  assertCents(sum, 'sum');
  return sum;
}

/** subtração — resultado negativo é erro (valores financeiros são não-negativos) */
export function subtractCents(a: number, B: number): number {
  assertCents(a, 'a');
  assertCents(B, 'b');
  if (B > a) {
    throw new MoneyError(`cannot subtract ${B} from ${a}: result would be negative`);
  }
  return a - B;
}

/** divisão de um valor por N partes sem perder centavos: resto distribuído nas primeiras partes */
export function splitCents(total: number, parts: number): number[] {
  assertCents(total, 'total');
  if (!Number.isInteger(parts) || parts < 1) {
    throw new MoneyError(`parts must be a positive integer, got: ${parts}`);
  }
  const base = Math.floor(total / parts);
  const remainder = total - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < remainder ? 1 : 0));
}

/** formata centavos como BRL (apenas apresentação — regras usam inteiros) */
export function formatBRL(cents: number): string {
  assertCents(cents, 'cents');
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
