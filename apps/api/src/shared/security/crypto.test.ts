import { describe, expect, it } from 'vitest';
import { decryptField, encryptField } from './crypto.js';

const KEY = Buffer.from(random32(1)).toString('base64');

function random32(seed: number): Uint8Array {
  const b = new Uint8Array(32);
  for (let i = 0; i < 32; i++) b[i] = (i + seed) % 256;
  return b;
}

describe('crypto (AES-256-GCM field encryption)', () => {
  it('round-trip preserva o conteúdo', () => {
    const secret = 'Nota clínica: sessão de hoje — paciente relata melhora.';
    expect(decryptField(encryptField(secret, KEY), KEY)).toBe(secret);
  });

  it('rejeita adulteração do ciphertext', () => {
    const enc = encryptField('confidencial', KEY);
    const parts = enc.split('.');
    const data = Buffer.from(parts[3]!, 'base64');
    data[0] = data[0]! ^ 1;
    parts[3] = data.toString('base64');
    expect(() => decryptField(parts.join('.'), KEY)).toThrow();
  });

  it('rejeita chave errada', () => {
    const otherKey = Buffer.from(random32(2)).toString('base64');
    expect(() => decryptField(encryptField('x', KEY), otherKey)).toThrow();
  });
});
