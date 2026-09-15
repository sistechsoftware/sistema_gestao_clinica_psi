import { spawnSync } from 'node:child_process';

// Aplica migrations no banco de teste antes da suíte (doc 05 §1).
// Sem DATABASE_URL: no-op (unit tests rodam normalmente).
export default function globalSetup(): void {
  const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    console.warn('[global-setup] sem DATABASE_URL — testes de integração serão pulados');
    return;
  }

  // Segredos de teste (nunca usados fora do vitest; produção falha sem env real)
  process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
  process.env.APP_ENV = process.env.APP_ENV ?? 'local';
  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL = process.env.DIRECT_URL ?? url;
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-0123456789abcdef0123456789abcdef';
  process.env.AES_MASTER_KEY = process.env.AES_MASTER_KEY ?? Buffer.alloc(32, 7).toString('base64');

  const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    throw new Error('prisma migrate deploy falhou no banco de teste');
  }
}
