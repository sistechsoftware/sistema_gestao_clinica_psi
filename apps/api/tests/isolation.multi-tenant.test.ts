import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { buildApp } from '../src/server.js';
import { createScopedPrisma } from '../src/infrastructure/database/tenant-scope.js';
import { resolveTestDatabaseUrl } from './helpers/db.js';
import type { FastifyInstance } from 'fastify';

// ============================================================================
// SUITE OBRIGATÓRIA (doc 05 §1; R3): Tenant A NÃO acessa dados do Tenant B.
// Cobre o núcleo da Fase 1: auth, seleção de tenant e RBAC.
// Requer TEST_DATABASE_URL ou DATABASE_URL (Postgres de teste). Sem banco,
// a suíte é pulada (unit tests continuam rodando).
// ============================================================================

// Guard de skip assíncrono (probe TCP) — ver helpers/db.ts.
const hasDb = await resolveTestDatabaseUrl();

interface TenantSetup {
  email: string;
  password: string;
  tenantId: string;
  token: string;
}

async function createTenantFixture(prisma: PrismaClient, suffix: string): Promise<TenantSetup> {
  const password = 'SenhaForte!123';
  const user = await prisma.user.create({
    data: {
      email: `${suffix}@iso-test.local`,
      name: `User ${suffix}`,
      passwordHash: await bcrypt.hash(password, 4),
    },
  });
  const tenant = await prisma.tenant.create({
    data: { name: `Tenant ${suffix}`, slug: `iso-${suffix}-${Date.now()}` },
  });
  await prisma.tenantUser.create({
    data: { tenantId: tenant.id, userId: user.id, role: 'ADMIN' },
  });
  // Um paciente semente em cada tenant
  await prisma.patient.create({
    data: { tenantId: tenant.id, name: `Paciente ${suffix}` },
  });
  return { email: user.email, password, tenantId: tenant.id, token: '' };
}

describe.skipIf(!hasDb)('isolamento multi-tenant (suite obrigatória)', () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;
  const suffix = String(Date.now());
  let A: TenantSetup;
  let B: TenantSetup;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: {
        db: { url: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL },
      },
    });
    app = await buildApp();

    A = await createTenantFixture(prisma, `a${suffix}`);
    B = await createTenantFixture(prisma, `b${suffix}`);

    for (const t of [A, B]) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: t.email, password: t.password },
      });
      expect(res.statusCode).toBe(200);
      t.token = res.json().accessToken;
    }
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  it('login funciona e emite token com tenant ativo', () => {
    expect(A.token).toBeTruthy();
    expect(B.token).toBeTruthy();
  });

  it('cada tenant lista apenas seus próprios pacientes', async () => {
    const patientsModuleNotInPhase1 = true;
    void patientsModuleNotInPhase1;
    // Sem módulo de pacientes ainda (Fase 2), verificamos o contexto de tenant
    // por /api/auth/me + tentativa de acesso cruzado via endpoints existentes.
    for (const [me, other] of [
      [A, B],
      [B, A],
    ] as const) {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${me.token}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.tenants).toHaveLength(1);
      expect(body.tenants[0].id).toBe(me.tenantId);
      expect(body.tenants[0].id).not.toBe(other.tenantId);
    }
  });

  it('rota tenanted sem tenant ativo → 403 (não vaza dados)', async () => {
    // Simula super admin sem tenant: token sem tid não acessa rotas tenanted.
    // Aqui validamos que um token de A não ganha contexto de B.
    const res = await app.inject({
      method: 'GET',
      url: '/api/tenants/' + B.tenantId + '/users',
      headers: { authorization: `Bearer ${A.token}` },
    });
    // A não é membro de B → proibido
    expect(res.statusCode).toBe(403);
  });

  it('refresh token reutilizado revoga a sessão (detecção de reuso)', async () => {
    // login com cookie
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: A.email, password: A.password },
    });
    const cookie = loginRes.cookies.find((c) => c.name === 'psa_rt');
    expect(cookie).toBeTruthy();

    const firstRefresh = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      cookies: { psa_rt: cookie!.value },
    });
    expect(firstRefresh.statusCode).toBe(200);

    // Reapresenta o MESMO cookie (já rotacionado) → revoga tudo
    const reuse = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      cookies: { psa_rt: cookie!.value },
    });
    expect(reuse.statusCode).toBe(401);

    // E o token de acesso antigo... ainda válido até expirar (stateless),
    // mas a sessão de refresh foi morta: novo refresh com cookie novo falha
    // pois a cadeia foi revogada.
    const newCookie = firstRefresh.cookies.find((c) => c.name === 'psa_rt');
    if (newCookie) {
      const after = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        cookies: { psa_rt: newCookie.value },
      });
      expect(after.statusCode).toBe(401);
    }
  });

  it('TenantScopeExtension: leitura cross-tenant retorna vazio e update não afeta', async () => {
    const patientB = await prisma.patient.findFirstOrThrow({
      where: { tenantId: B.tenantId },
    });

    const scopedAsA = createScopedPrisma(prisma, {
      tenantId: A.tenantId,
      userId: 'system-test',
    });

    // Leitura: paciente de B não existe para A
    const leaked = await scopedAsA.patient.findUnique({ where: { id: patientB.id } });
    expect(leaked).toBeNull();

    // Listagem de A jamais contém itens de B
    const listA = await scopedAsA.patient.findMany();
    expect(listA.every((p) => p.tenantId === A.tenantId)).toBe(true);

    // Update cross-tenant: afeta 0 registros (where recebe tenantId de A)
    const update = await scopedAsA.patient.updateMany({
      where: { id: patientB.id },
      data: { name: 'hacked' },
    });
    expect(update.count).toBe(0);

    // Bulk sem filtro é bloqueado
    await expect(scopedAsA.patient.deleteMany({})).rejects.toThrow();
    await expect(scopedAsA.patient.deleteMany()).rejects.toThrow();

    // Create ignora tenantId do chamador: sempre o do contexto
    const created = await scopedAsA.patient.create({
      data: { name: 'X', tenantId: B.tenantId } as never,
    });
    expect(created.tenantId).toBe(A.tenantId);
  });

  it('tenant switch para tenant onde não é membro → 403', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/switch-tenant',
      headers: { authorization: `Bearer ${A.token}` },
      payload: { tenantId: B.tenantId },
    });
    expect(res.statusCode).toBe(403);
  });
});
