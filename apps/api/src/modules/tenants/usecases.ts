import { getRawPrisma } from '../../infrastructure/database/client.js';
import { AuditService, type AuditRequestInfo } from '../../infrastructure/audit/audit-service.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors.js';
import { hashPassword } from '../../shared/security/password.js';
import type {
  AddTenantUserInput,
  CreateTenantInput,
  UpdateTenantInput,
  UpdateTenantUserInput,
} from './dto.js';

// ============================================================================
// Casos de uso de tenants (§9). Criar tenant é operação autenticada mas
// pré-seleção: não usa escopo de tenant (opera no client cru).
// ============================================================================

const audit = new AuditService(getRawPrisma());

export async function createTenant(
  userId: string,
  input: CreateTenantInput,
  ctx: { req?: AuditRequestInfo },
): Promise<{ id: string; name: string; slug: string }> {
  const prisma = getRawPrisma();

  const exists = await prisma.tenant.findUnique({ where: { slug: input.slug } });
  if (exists) throw new ConflictError('Slug already in use');

  const tenant = await prisma.$transaction(async (tx) => {
    const created = await tx.tenant.create({
      data: { name: input.name, slug: input.slug, timezone: input.timezone },
    });
    await tx.tenantUser.create({
      data: { tenantId: created.id, userId, role: 'ADMIN' },
    });
    // Assinatura trial no plano FREE (Fase 9 formaliza; aqui só o vínculo)
    const freePlan = await tx.plan.findUnique({ where: { key: 'FREE' } });
    if (freePlan) {
      await tx.subscription.create({
        data: {
          tenantId: created.id,
          planId: freePlan.id,
          status: 'TRIALING',
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    }
    return created;
  });

  await audit.record(
    {
      action: 'tenant.created',
      tenantId: tenant.id,
      userId,
      entity: 'Tenant',
      entityId: tenant.id,
    },
    ctx.req,
  );
  return { id: tenant.id, name: tenant.name, slug: tenant.slug };
}

export async function listMyTenants(
  userId: string,
): Promise<Array<{ id: string; name: string; slug: string; role: string; isActive: boolean }>> {
  const memberships = await getRawPrisma().tenantUser.findMany({
    where: { userId, isActive: true },
    include: { tenant: true },
  });
  return memberships
    .filter((m) => !m.tenant.deletedAt)
    .map((m) => ({
      id: m.tenantId,
      name: m.tenant.name,
      slug: m.tenant.slug,
      role: m.role,
      isActive: m.tenant.isActive,
    }));
}

export async function updateTenant(
  userId: string,
  tenantId: string,
  input: UpdateTenantInput,
  ctx: { req?: AuditRequestInfo },
): Promise<{ id: string; name: string; slug: string; timezone: string }> {
  const prisma = getRawPrisma();
  const membership = await prisma.tenantUser.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
  });
  if (!membership?.isActive || membership.role !== 'ADMIN') {
    throw new ForbiddenError('Only tenant admins can update the tenant');
  }

  if (input.slug) {
    const clash = await prisma.tenant.findFirst({
      where: { slug: input.slug, NOT: { id: tenantId } },
    });
    if (clash) throw new ConflictError('Slug already in use');
  }

  const tenant = await prisma.tenant.update({
    where: { id: tenantId },
    data: { name: input.name, slug: input.slug, timezone: input.timezone },
  });

  await audit.record(
    { action: 'tenant.updated', tenantId, userId, entity: 'Tenant', entityId: tenantId },
    ctx.req,
  );
  return { id: tenant.id, name: tenant.name, slug: tenant.slug, timezone: tenant.timezone };
}

export async function addTenantUser(
  actorId: string,
  tenantId: string,
  input: AddTenantUserInput,
  ctx: { req?: AuditRequestInfo },
): Promise<{ id: string; email: string; role: string }> {
  const prisma = getRawPrisma();
  const actor = await prisma.tenantUser.findUnique({
    where: { tenantId_userId: { tenantId, userId: actorId } },
  });
  if (!actor?.isActive || actor.role !== 'ADMIN') {
    throw new ForbiddenError('Only tenant admins can add users');
  }

  let user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        name: input.name,
        passwordHash: await hashPassword(input.password),
      },
    });
  }

  const existing = await prisma.tenantUser.findUnique({
    where: { tenantId_userId: { tenantId, userId: user.id } },
  });
  if (existing) throw new ConflictError('User is already a member of this tenant');

  const membership = await prisma.tenantUser.create({
    data: { tenantId, userId: user.id, role: input.role, invitedAt: new Date() },
  });

  await audit.record(
    {
      action: 'tenant.user_added',
      tenantId,
      userId: actorId,
      entity: 'TenantUser',
      entityId: membership.id,
      metadata: { addedUserId: user.id, role: input.role },
    },
    ctx.req,
  );
  return { id: user.id, email: user.email, role: input.role };
}

export async function updateTenantUser(
  actorId: string,
  tenantId: string,
  membershipId: string,
  input: UpdateTenantUserInput,
  ctx: { req?: AuditRequestInfo },
): Promise<{ id: string; role: string; isActive: boolean }> {
  const prisma = getRawPrisma();
  const actor = await prisma.tenantUser.findUnique({
    where: { tenantId_userId: { tenantId, userId: actorId } },
  });
  if (!actor?.isActive || actor.role !== 'ADMIN') {
    throw new ForbiddenError('Only tenant admins can update users');
  }

  const target = await prisma.tenantUser.findFirst({ where: { id: membershipId, tenantId } });
  if (!target) throw new NotFoundError('Membership not found');

  if (target.userId === actorId && input.isActive === false) {
    throw new ForbiddenError('Cannot deactivate your own membership');
  }

  const updated = await prisma.tenantUser.update({
    where: { id: target.id },
    data: {
      role: input.role,
      isActive: input.isActive,
      extraPerms: input.extraPerms,
      revokedPerms: input.revokedPerms,
    },
  });

  await audit.record(
    {
      action: 'tenant.user_updated',
      tenantId,
      userId: actorId,
      entity: 'TenantUser',
      entityId: target.id,
      metadata: { ...input },
    },
    ctx.req,
  );
  return { id: updated.id, role: updated.role, isActive: updated.isActive };
}

export async function listTenantUsers(
  userId: string,
  tenantId: string,
): Promise<Array<{ id: string; name: string; email: string; role: string; isActive: boolean }>> {
  const actor = await getRawPrisma().tenantUser.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
  });
  if (!actor?.isActive) throw new ForbiddenError('Not a member of this tenant');

  const memberships = await getRawPrisma().tenantUser.findMany({
    where: { tenantId },
    include: { user: true },
  });
  return memberships.map((m) => ({
    id: m.id,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
    isActive: m.isActive,
  }));
}
