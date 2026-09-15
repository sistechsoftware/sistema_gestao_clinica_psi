import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';

// ============================================================================
// Cifragem de campo AES-256-GCM (doc 01 R4; §14) para dados clínicos.
// Formato: v1.<iv_b64>.<tag_b64>.<ciphertext_b64>  (autenticado)
// ============================================================================

const V1 = 'v1';

export interface EncryptedValue {
  readonly raw: string;
}

function importKey(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, 'base64');
  if (key.length !== 32) {
    throw new Error('AES_MASTER_KEY inválida: base64 de exatamente 32 bytes');
  }
  return key;
}

export function encryptField(plaintext: string, base64Key: string): string {
  const key = importKey(base64Key);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [V1, iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(
    '.',
  );
}

export function decryptField(encrypted: string, base64Key: string): string {
  const [version, ivB64, tagB64, dataB64] = encrypted.split('.');
  if (version !== V1 || !ivB64 || !tagB64 || !dataB64) {
    throw new Error('encrypted value malformed');
  }
  const key = importKey(base64Key);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

// ============================================================================
// Refresh tokens: geramos 32 bytes aleatórios; banco guarda SHA-256.
// ============================================================================

export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
