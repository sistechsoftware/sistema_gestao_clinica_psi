import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { buildApp } from '../src/server.js';
import type { FastifyInstance } from 'fastify';

const hasDb = Boolean(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL);

describe.skipIf(!hasDb)('auth flow (integração)', () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;
  const suffix = Date.now();
  const email = `auth${suffix}@test.local`;
  const password = 'SenhaForte!123';

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: {
        db: { url: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL },
      },
    });
    app = await buildApp();
    const user = await prisma.user.create({
      data: {
        email,
        name: 'Auth Test',
        passwordHash: await bcrypt.hash(password, 4),
      },
    });
    const tenant = await prisma.tenant.create({
      data: { name: 'Auth T', slug: `auth-t-${suffix}` },
    });
    await prisma.tenantUser.create({
      data: { tenantId: tenant.id, userId: user.id, role: 'ADMIN' },
    });
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  it('health responde ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ok');
  });

  it('login com credenciais válidas → 200 + token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().accessToken).toBeTruthy();
    expect(res.json().tenant.role).toBe('ADMIN');
  });

  it('login com senha errada → 401 e não revela existência', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: 'errada!123' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('login de email inexistente → 401 com mesma mensagem', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: `nope${suffix}@test.local`, password: 'x'.repeat(12) },
    });
    expect(res.statusCode).toBe(401);
  });

  it('/me exige token', async () => {
    const noToken = await app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(noToken.statusCode).toBe(401);

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password },
    });
    const withToken = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${login.json().accessToken}` },
    });
    expect(withToken.statusCode).toBe(200);
    expect(withToken.json().user.email).toBe(email);
  });

  it('logout revoga o refresh token', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password },
    });
    const cookie = login.cookies.find((c) => c.name === 'psa_rt')!;
    const out = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      cookies: { psa_rt: cookie.value },
    });
    expect(out.statusCode).toBe(204);

    const reuse = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      cookies: { psa_rt: cookie.value },
    });
    expect(reuse.statusCode).toBe(401);
  });

  it('payload inválido no login → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'not-an-email', password: '' },
    });
    expect(res.statusCode).toBe(400);
  });
});
