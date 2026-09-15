import type { FastifyInstance, FastifyReply } from 'fastify';
import {
  changePassword,
  login,
  logout,
  me,
  refresh,
  switchTenant,
  accessTtlSeconds,
} from './usecases.js';
import { changePasswordSchema, loginSchema, switchTenantSchema } from './dto.js';
import { requestAuditInfo } from '../../infrastructure/audit/audit-service.js';
import { env } from '../../config/env.js';
import { getJwtPayload } from '../../types/jwt.js';

// ============================================================================
// Rotas /api/auth (§37). Validação por Zod; erros via DomainError → handler
// central. Rate limit próprio no login (brute force, §10).
// Refresh token vai em cookie httpOnly escopado a /api/auth.
// ============================================================================

const REFRESH_COOKIE = 'psa_rt';

export function setRefreshCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(REFRESH_COOKIE, token, {
    path: '/api/auth',
    httpOnly: true,
    sameSite: 'lax',
    secure: env.APP_ENV !== 'local',
    maxAge: env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60,
  });
}

export function clearRefreshCookie(reply: FastifyReply): void {
  reply.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/auth/login — público
  app.post(
    '/login',
    {
      config: {
        rateLimit: { max: env.RATE_LIMIT_AUTH_MAX, timeWindow: env.RATE_LIMIT_TIME_WINDOW },
      },
    },
    async (request, reply) => {
      const body = loginSchema.parse(request.body);
      const result = await login(body, {
        sign: (payload) => app.jwt.sign(payload as object),
        req: requestAuditInfo(request),
      });
      setRefreshCookie(reply, result.refreshToken);
      reply.send({
        accessToken: result.accessToken,
        expiresIn: accessTtlSeconds(),
        user: result.user,
        tenant: result.tenant,
      });
    },
  );

  // POST /api/auth/refresh — rotação + detecção de reuso
  app.post('/refresh', async (request, reply) => {
    const token = request.cookies[REFRESH_COOKIE];
    if (!token) {
      reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'No refresh token' } });
      return;
    }
    const result = await refresh(token, {
      sign: (payload) => app.jwt.sign(payload as object),
      req: requestAuditInfo(request),
    });
    setRefreshCookie(reply, result.refreshToken);
    reply.send({
      accessToken: result.accessToken,
      expiresIn: accessTtlSeconds(),
      user: result.user,
      tenant: result.tenant,
    });
  });

  // POST /api/auth/logout
  app.post('/logout', async (request, reply) => {
    const token = request.cookies[REFRESH_COOKIE];
    const userId = request.user ? getJwtPayload(request).sub : undefined;
    await logout(token, userId, { req: requestAuditInfo(request) });
    clearRefreshCookie(reply);
    reply.status(204).send();
  });

  // GET /api/auth/me
  app.get('/me', { preHandler: [app.authenticate] }, async (request, reply) => {
    const result = await me(getJwtPayload(request).sub);
    reply.send(result);
  });

  // POST /api/auth/switch-tenant — troca o tenant ativo da sessão
  app.post('/switch-tenant', { preHandler: [app.authenticate] }, async (request, reply) => {
    const body = switchTenantSchema.parse(request.body);
    const result = await switchTenant(getJwtPayload(request).sub, body, {
      sign: (payload) => app.jwt.sign(payload as object),
      req: requestAuditInfo(request),
    });
    setRefreshCookie(reply, result.refreshToken);
    reply.send({
      accessToken: result.accessToken,
      expiresIn: accessTtlSeconds(),
      user: result.user,
      tenant: result.tenant,
    });
  });

  // POST /api/auth/change-password
  app.post('/change-password', { preHandler: [app.authenticate] }, async (request, reply) => {
    const body = changePasswordSchema.parse(request.body);
    await changePassword(getJwtPayload(request).sub, body, {
      req: requestAuditInfo(request),
    });
    clearRefreshCookie(reply);
    reply.status(204).send();
  });
}
