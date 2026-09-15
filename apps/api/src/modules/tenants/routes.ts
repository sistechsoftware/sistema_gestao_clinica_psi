import type { FastifyInstance } from 'fastify';
import { requestAuditInfo } from '../../infrastructure/audit/audit-service.js';
import { getJwtPayload } from '../../types/jwt.js';
import {
  addTenantUser,
  createTenant,
  listMyTenants,
  listTenantUsers,
  updateTenant,
  updateTenantUser,
} from './usecases.js';
import {
  addTenantUserSchema,
  createTenantSchema,
  updateTenantSchema,
  updateTenantUserSchema,
} from './dto.js';

// Rotas /api/tenants (§37). Autenticação sempre; permissões por operação.
export async function tenantRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/tenants — cria tenant e torna o criador ADMIN dele
  app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const body = createTenantSchema.parse(request.body);
    const tenant = await createTenant(getJwtPayload(request).sub, body, {
      req: requestAuditInfo(request),
    });
    reply.status(201).send(tenant);
  });

  // GET /api/tenants/mine — tenants do usuário logado
  app.get('/mine', { preHandler: [app.authenticate] }, async (request, reply) => {
    reply.send(await listMyTenants(getJwtPayload(request).sub));
  });

  // PATCH /api/tenants/:tenantId — admin do tenant
  app.patch('/:tenantId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.params as { tenantId: string };
    const body = updateTenantSchema.parse(request.body);
    reply.send(
      await updateTenant(getJwtPayload(request).sub, tenantId, body, {
        req: requestAuditInfo(request),
      }),
    );
  });

  // GET /api/tenants/:tenantId/users
  app.get('/:tenantId/users', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.params as { tenantId: string };
    reply.send(await listTenantUsers(getJwtPayload(request).sub, tenantId));
  });

  // POST /api/tenants/:tenantId/users — admin adiciona usuário
  app.post('/:tenantId/users', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { tenantId } = request.params as { tenantId: string };
    const body = addTenantUserSchema.parse(request.body);
    reply.status(201).send(
      await addTenantUser(getJwtPayload(request).sub, tenantId, body, {
        req: requestAuditInfo(request),
      }),
    );
  });

  // PATCH /api/tenants/:tenantId/users/:membershipId
  app.patch(
    '/:tenantId/users/:membershipId',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { tenantId, membershipId } = request.params as {
        tenantId: string;
        membershipId: string;
      };
      const body = updateTenantUserSchema.parse(request.body);
      reply.send(
        await updateTenantUser(getJwtPayload(request).sub, tenantId, membershipId, body, {
          req: requestAuditInfo(request),
        }),
      );
    },
  );
}
