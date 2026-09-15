import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';

// ============================================================================
// Helpers de integração (doc 05 §1): exigem DATABASE_URL apontando para um
// Postgres de TESTE. Sem ela, a suíte é pulada (não falha) — CI/local sem
// banco ainda roda os unit tests.
// Cria um banco efêmero por execução, roda migrations + seed e limpa depois.
// ============================================================================

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL || process.env.TEST_DATABASE_URL);
}

export function requireDb(): void {
  if (!hasDatabase()) {
    console.warn('[it] sem DATABASE_URL — pulando testes de integração');
    // eslint-disable-next-line @typescript-eslint/only-todos
    return process.exit(0); // vitest: exit code 0 nos hooks = skip do arquivo
  }
}

let admin: PrismaClient | null = null;

export function getAdminClient(): PrismaClient {
  if (!admin) {
    admin = new PrismaClient({
      datasources: { db: { url: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL } },
    });
  }
  return admin;
}

/** Cria banco efêmero `psa_test_<hex>` e retorna a URL de conexão dele. */
export async function createEphemeralDatabase(): Promise<string> {
  const base = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL!;
  const dbName = `psa_test_${randomBytes(4).toString('hex')}`;
  const url = new URL(base);
  url.pathname = `/${dbName}`;

  const adminClient = new PrismaClient({ datasources: { db: { url: base } } });
  await adminClient.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
  await adminClient.$disconnect();

  await runPrisma(['migrate', 'deploy'], url.toString());
  return url.toString();
}

export async function destroyEphemeralDatabase(dbName: string): Promise<void> {
  const base = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL!;
  const adminClient = new PrismaClient({ datasources: { db: { url: base } } });
  await adminClient.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
  await adminClient.$disconnect();
}

function runPrisma(args: string[], datasourceUrl: string): void {
  const result = spawnSync('npx', ['prisma', ...args], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: datasourceUrl,
      DIRECT_URL: datasourceUrl,
    },
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    throw new Error(`prisma ${args.join(' ')} falhou`);
  }
}
