import { spawnSync } from 'node:child_process';
import { connect } from 'node:net';

// Aplica migrations no banco de teste antes da suíte (doc 05 §1).
// Sem DATABASE_URL: no-op (unit tests rodam normalmente).
// DATABASE_URL definido mas inacessível (ex.: Docker desligado): pula com
// aviso claro em vez de falhar toda a suíte.
/** True se o host:port do Postgres aceita conexão TCP (timeout curto). */
async function isReachable(url: string): Promise<boolean> {
  const u = new URL(url);
  return new Promise((resolve) => {
    const socket = connect({ host: u.hostname, port: Number(u.port || 5432) });
    const done = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(2000);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

export default async function globalSetup(): Promise<void> {
  const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    console.warn('[global-setup] sem DATABASE_URL — testes de integração serão pulados');
    return;
  }

  if (!(await isReachable(url))) {
    console.warn(
      '[global-setup] DATABASE_URL definido mas Postgres inacessível — ' +
        'testes de integração serão pulados (suba o banco com: npm run db:up)',
    );
    process.env.TEST_DATABASE_URL = '';
    process.env.DATABASE_URL = '';
    return;
  }

  // Segredos de teste (nunca usados fora do vitest; produção falha sem env real)
  process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
  process.env.APP_ENV = process.env.APP_ENV ?? 'local';
  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL = process.env.DIRECT_URL ?? url;
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-0123456789abcdef0123456789abcdef';
  process.env.AES_MASTER_KEY = process.env.AES_MASTER_KEY ?? Buffer.alloc(32, 7).toString('base64');
  // Margem para suítes que fazem vários logins (o default 5 é para produção)
  process.env.RATE_LIMIT_AUTH_MAX = process.env.RATE_LIMIT_AUTH_MAX ?? '50';

  const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    throw new Error('prisma migrate deploy falhou no banco de teste');
  }
}
