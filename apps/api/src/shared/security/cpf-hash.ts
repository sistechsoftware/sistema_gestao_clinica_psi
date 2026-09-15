import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';

// ============================================================================
// CPF (R4): nunca persistimos o número. Guardamos HMAC-SHA256 com pepper
// (JWT_SECRET) para busca por igualdade + máscara para exibição.
// ============================================================================

export function cpfHmac(cpfDigits: string): string {
  return createHmac('sha256', env.JWT_SECRET).update(`cpf:${cpfDigits}`).digest('hex');
}

export function cpfMatchesHash(cpfDigits: string, hash: string): boolean {
  const a = Buffer.from(cpfHmac(cpfDigits), 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
