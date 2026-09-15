import type { ScopedPrismaClient } from '../infrastructure/database/tenant-scope.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** presente após requireTenant — contexto do tenant ativo */
    tenant?: {
      tenantId: string;
      role: 'ADMIN' | 'PROFESSIONAL' | 'SECRETARY';
      tenantUser: {
        id: string;
        extraPerms: string[];
        revokedPerms: string[];
      };
    };
    /** Prisma client com TenantScopeExtension (após requireTenant) */
    scopedPrisma?: ScopedPrismaClient;
  }

  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireTenant: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requirePermission: (
      permission: string,
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export {};
