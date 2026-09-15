import jwt from '@fastify/jwt';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ForbiddenError, UnauthorizedError } from '../errors.js';
import { getRawPrisma } from '../../infrastructure/database/client.js';
import { createScopedPrisma } from '../../infrastructure/database/tenant-scope.js';
import { ROLE_DEFAULT_PERMISSIONS, type PermissionCode } from '@psa/shared/permissions';
import { getJwtPayload, type JwtPayload } from '../../types/jwt.js';

// ============================================================================
// Auth plugin (doc 02 §2): rota → authenticate (JWT) → requireTenant (contexto
// multi-tenant) → requirePermission (RBAC granular, §11). Tenant é resolvido
// do token (tid) e validado contra TenantUser ativo — nunca do body (§37).
// Permissões efetivas = papel padrão + extraPerms − revokedPerms (doc 04 §2).
// ============================================================================

// Cache em memória dos códigos por papel (papéis de sistema são estáticos).
const rolePermissionCache = new Map<string, readonly string[]>();

export function getRolePermissionSet(role: string): readonly string[] {
  const cached = rolePermissionCache.get(role);
  if (cached) return cached;
  const defaults: readonly PermissionCode[] =
    ROLE_DEFAULT_PERMISSIONS[role as keyof typeof ROLE_DEFAULT_PERMISSIONS] ?? [];
  rolePermissionCache.set(role, defaults);
  return defaults;
}

export async function registerAuthPlugin(app: FastifyInstance): Promise<void> {
  await app.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'dev-only-secret-change-me',
  });

  // 'user' já é decorado por @fastify/jwt; os demais começam undefined por request
  app.decorateRequest('tenant', undefined);
  app.decorateRequest('scopedPrisma', undefined);

  app.decorate('authenticate', async (request: FastifyRequest, _reply: FastifyReply) => {
    try {
      await request.jwtVerify<JwtPayload>();
    } catch {
      throw new UnauthorizedError('Invalid or expired access token');
    }
  });

  app.decorate('requireTenant', async (request: FastifyRequest, _reply: FastifyReply) => {
    const payload = getJwtPayload(request);
    if (!payload) throw new UnauthorizedError('Authentication required');
    if (!payload.tid) {
      throw new ForbiddenError('No active tenant selected for this session');
    }

    const tenantUser = await getRawPrisma().tenantUser.findUnique({
      where: {
        tenantId_userId: { tenantId: payload.tid, userId: payload.sub },
      },
      include: { tenant: true },
    });

    const active =
      tenantUser !== null &&
      tenantUser.isActive &&
      !tenantUser.tenant.deletedAt &&
      tenantUser.tenant.isActive;

    if (!active || !tenantUser) {
      throw new ForbiddenError('Tenant membership is not active');
    }

    request.tenant = {
      tenantId: payload.tid,
      role: tenantUser.role,
      tenantUser: {
        id: tenantUser.id,
        extraPerms: tenantUser.extraPerms,
        revokedPerms: tenantUser.revokedPerms,
      },
    };
    request.scopedPrisma = createScopedPrisma(getRawPrisma(), {
      tenantId: payload.tid,
      userId: payload.sub,
    });
  });

  app.decorate('requirePermission', (permission: string) => {
    return async (request: FastifyRequest, _reply: FastifyReply) => {
      const payload = getJwtPayload(request);
      if (!payload) throw new UnauthorizedError('Authentication required');

      // Super admin sem tenant ativo: apenas rotas de plataforma (R10).
      if (payload.sam && !payload.tid) return;
      if (!payload.tid || !request.tenant) {
        throw new ForbiddenError('No active tenant');
      }

      const tenantUser = await getRawPrisma().tenantUser.findUnique({
        where: { tenantId_userId: { tenantId: payload.tid, userId: payload.sub } },
      });
      if (!tenantUser?.isActive) {
        throw new ForbiddenError('Tenant membership is not active');
      }

      if (tenantUser.revokedPerms.includes(permission)) {
        throw new ForbiddenError(`Permission denied: ${permission}`);
      }
      if (tenantUser.extraPerms.includes(permission)) return;

      const rolePerms = getRolePermissionSet(tenantUser.role);
      if (!rolePerms.includes(permission)) {
        throw new ForbiddenError(`Permission denied: ${permission}`);
      }
    };
  });
}
