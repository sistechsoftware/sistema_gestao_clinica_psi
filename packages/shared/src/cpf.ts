// ============================================================================
// CPF — validação e máscara (doc 01 R4: minimização LGPD)
// Armazenamento: hash determinístico (SHA-256 + pepper na API) p/ busca por
// igualdade; exibição apenas da máscara. O CPF em claro nunca persiste.
// ============================================================================

/** valida dígitos verificadores; rejeita sequências repetidas (111.111.111-11) */
export function isValidCPF(input: string): boolean {
  const digits = input.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(digits[i]) * (10 - i);
  let check1 = ((sum * 10) % 11) % 10;
  if (check1 !== Number(digits[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(digits[i]) * (11 - i);
  const check2 = ((sum * 10) % 11) % 10;
  return check2 === Number(digits[10]);
}

/** mantém apenas dígitos */
export function normalizeCPF(input: string): string {
  return input.replace(/\D/g, '');
}

/** ***.***.789-** — preserva últimos 3 dígitos antes dos verificadores */
export function maskCPF(input: string): string {
  const digits = normalizeCPF(input);
  if (digits.length !== 11) {
    throw new Error('maskCPF: expected 11 digits');
  }
  return `***.***.${digits.slice(8, 11)}-**`;
}

/** gera CPFs válidos para testes/seeds (não é validação de produção) */
export function randomValidCPF(): string {
  const base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  if (new Set(base).size === 1) base[8] = (base[8]! + 1) % 10;
  const digit = (nums: number[]): number => {
    const sum = nums.reduce((acc, d, i) => acc + d * (nums.length + 1 - i), 0);
    const r = ((sum * 10) % 11) % 10;
    return r;
  };
  const d1 = digit(base);
  const d2 = digit([...base, d1]);
  return [...base, d1, d2].join('');
}
