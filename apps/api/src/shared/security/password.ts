import bcrypt from 'bcryptjs';
import { env } from '../../config/env.js';

const MIN_PASSWORD_LENGTH = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** política mínima — sem regras excessivas; comprimento é o fator dominante */
export function passwordPolicyError(plain: string): string | null {
  if (plain.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (/^(.)\1+$/.test(plain)) {
    return 'Password must not be a single repeated character';
  }
  return null;
}
