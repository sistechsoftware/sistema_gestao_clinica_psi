import { env } from '../../config/env.js';
import { getRawPrisma } from '../../infrastructure/database/client.js';
import { AuditService, type AuditRequestInfo } from '../../infrastructure/audit/audit-service.js';
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../shared/errors.js';
import { generateRefreshToken } from '../../shared/security/crypto.js';
import {
  hashPassword,
  passwordPolicyError,
  verifyPassword,
} from '../../shared/security/password.js';
import { sha256Hex } from '../../shared/security/cpf-hash.js';
import type { JwtPayload } from '../../types/jwt.js';
import type { ChangePasswordInput, LoginInput, SwitchTenantInput } from './dto.js';

// ============================================================================
// Casos de uso de autenticação (§10) — camada de domínio, sem HTTP.
// Access token curto (JWT, tid = tenant ativo) + refresh opaco rotativo
// com detecção de reuso: reuso ⇒ sessão revogada + auditoria (§10, §34).
// ============================================================================

const audit = new AuditService(getRawPrisma());

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthSigner {
  sign(payload: JwtPayload): string;
}

export function accessTtlSeconds(): number {
  const m = /^(\d+)(m|h|s)$/.exec(env.JWT_ACCESS_TTL);
  if (!m) return 15 * 60;
  const n = Number(m[1]);
  return m[2] === 'h' ? n * 3600 : m[2] === 'm' ? n * 60 : n;
}

async function createSessionAndIssue(
  user: { id: string; email: string; name: string; isSuperAdmin: boolean },
  opts: { tenantId: string | null; role: string | null; sign: AuthSigner['sign'] },
): Promise<TokenPair> {
  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  await getRawPrisma().session.create({
    data: {
      userId: user.id,
      activeTenantId: opts.tenantId,
      refreshToken: sha256Hex(refreshToken),
      expiresAt,
    },
  });

  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    sam: user.isSuperAdmin,
    ...(opts.tenantId
      ? { tid: opts.tenantId, role: (opts.role ?? undefined) as JwtPayload['role'] }
      : {}),
  };

  return {
    accessToken: opts.sign(payload),
    refreshToken,
  };
}

export interface LoginResult extends TokenPair {
  user: {
    id: string;
    name: string;
    email: string;
    isSuperAdmin: boolean;
  };
  tenant: { id: string; name: string; slug: string; role: string } | null;
}

export async function login(
  input: LoginInput,
  ctx: { sign: AuthSigner['sign']; req?: AuditRequestInfo },
): Promise<LoginResult> {
  const user = await getRawPrisma().user.findUnique({
    where: { email: input.email.toLowerCase().trim() },
  });

  const ok = user?.isActive ? await verifyPassword(input.password, user.passwordHash) : false;

  if (!user || !ok) {
    await audit.record({ action: 'auth.login_failed', metadata: { email: input.email } }, ctx.req);
    throw new UnauthorizedError('Invalid credentials');
  }

  // Primeiro membership ativo como tenant inicial (ADMIN > PROFESSIONAL > SECRETARY)
  const memberships = await getRawPrisma().tenantUser.findMany({
    where: { userId: user.id, isActive: true },
    include: { tenant: true },
  });
  const membership = memberships
    .filter((m) => !m.tenant.deletedAt && m.tenant.isActive)
    .sort((a, b) => a.role.localeCompare(b.role))[0];

  const tokens = await createSessionAndIssue(user, {
    tenantId: membership?.tenantId ?? null,
    role: membership?.role ?? null,
    sign: ctx.sign,
  });

  await getRawPrisma().user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  await audit.record(
    {
      action: 'auth.login',
      tenantId: membership?.tenantId ?? null,
      userId: user.id,
      metadata: { tenant: membership?.tenant.slug },
    },
    ctx.req,
  );

  return {
    ...tokens,
    user: { id: user.id, name: user.name, email: user.email, isSuperAdmin: user.isSuperAdmin },
    tenant: membership
      ? {
          id: membership.tenantId,
          name: membership.tenant.name,
          slug: membership.tenant.slug,
          role: membership.role,
        }
      : null,
  };
}

export async function refresh(
  rawRefreshToken: string,
  ctx: { sign: AuthSigner['sign']; req?: AuditRequestInfo },
): Promise<LoginResult> {
  const tokenHash = sha256Hex(rawRefreshToken);
  const session = await getRawPrisma().session.findUnique({
    where: { refreshToken: tokenHash },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    throw new UnauthorizedError('Refresh token invalid or expired');
  }

  if (session.revokedAt) {
    // REUSO DETECTADO: token já rotacionado foi reapresentado.
    // Revoga toda a cadeia do usuário (defesa contra roubo de token, §10).
    await getRawPrisma().session.updateMany({
      where: { userId: session.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await audit.record(
      { action: 'auth.refresh_reuse', userId: session.userId, tenantId: session.activeTenantId },
      ctx.req,
    );
    throw new UnauthorizedError('Refresh token reuse detected — all sessions revoked');
  }

  // Rotação: revoga a sessão atual e emite nova
  await getRawPrisma().session.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });

  const memberships = await getRawPrisma().tenantUser.findMany({
    where: { userId: session.userId, isActive: true },
    include: { tenant: true },
  });
  const membership =
    memberships.find((m) => m.tenantId === session.activeTenantId) ??
    memberships.find((m) => !m.tenant.deletedAt && m.tenant.isActive) ??
    null;

  const tokens = await createSessionAndIssue(session.user, {
    tenantId: membership?.tenantId ?? null,
    role: membership?.role ?? null,
    sign: ctx.sign,
  });

  return {
    ...tokens,
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      isSuperAdmin: session.user.isSuperAdmin,
    },
    tenant: membership
      ? {
          id: membership.tenantId,
          name: membership.tenant.name,
          slug: membership.tenant.slug,
          role: membership.role,
        }
      : null,
  };
}

export async function logout(
  rawRefreshToken: string | undefined,
  userId: string | undefined,
  ctx: { req?: AuditRequestInfo },
): Promise<void> {
  if (rawRefreshToken) {
    await getRawPrisma().session.updateMany({
      where: { refreshToken: sha256Hex(rawRefreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  if (userId) {
    await audit.record({ action: 'auth.logout', userId }, ctx.req);
  }
}

export async function me(userId: string): Promise<{
  user: { id: string; name: string; email: string; isSuperAdmin: boolean };
  tenants: Array<{ id: string; name: string; slug: string; role: string; active: boolean }>;
}> {
  const user = await getRawPrisma().user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User not found');

  const memberships = await getRawPrisma().tenantUser.findMany({
    where: { userId, isActive: true },
    include: { tenant: true },
  });

  return {
    user: { id: user.id, name: user.name, email: user.email, isSuperAdmin: user.isSuperAdmin },
    tenants: memberships
      .filter((m) => !m.tenant.deletedAt)
      .map((m) => ({
        id: m.tenantId,
        name: m.tenant.name,
        slug: m.tenant.slug,
        role: m.role,
        active: m.tenant.isActive,
      })),
  };
}

export async function switchTenant(
  userId: string,
  input: SwitchTenantInput,
  ctx: { sign: AuthSigner['sign']; req?: AuditRequestInfo },
): Promise<LoginResult> {
  const membership = await getRawPrisma().tenantUser.findFirst({
    where: { userId, tenantId: input.tenantId, isActive: true },
    include: { tenant: true },
  });
  if (!membership || membership.tenant.deletedAt || !membership.tenant.isActive) {
    throw new ForbiddenError('Not a member of this tenant');
  }

  const user = await getRawPrisma().user.findUniqueOrThrow({ where: { id: userId } });
  // Emite access token apontando para o novo tenant ativo (sessão nova).
  const tokens = await createSessionAndIssue(user, {
    tenantId: membership.tenantId,
    role: membership.role,
    sign: ctx.sign,
  });

  await audit.record(
    { action: 'auth.tenant_switch', userId, tenantId: membership.tenantId },
    ctx.req,
  );

  return {
    ...tokens,
    user: { id: user.id, name: user.name, email: user.email, isSuperAdmin: user.isSuperAdmin },
    tenant: {
      id: membership.tenantId,
      name: membership.tenant.name,
      slug: membership.tenant.slug,
      role: membership.role,
    },
  };
}

export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
  ctx: { req?: AuditRequestInfo },
): Promise<void> {
  const policyError = passwordPolicyError(input.newPassword);
  if (policyError) throw new ValidationError(policyError);

  const user = await getRawPrisma().user.findUniqueOrThrow({ where: { id: userId } });
  const ok = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!ok) throw new UnauthorizedError('Current password is incorrect');

  await getRawPrisma().$transaction([
    getRawPrisma().user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(input.newPassword) },
    }),
    // Revoga todas as sessões (força re-login em todos os dispositivos)
    getRawPrisma().session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await audit.record({ action: 'auth.password_changed', userId }, ctx.req);
}
