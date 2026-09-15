import type { Prisma, PrismaClient } from '@prisma/client';

// ============================================================================
// Auditoria (§34): toda mutation relevante grava AuditLog. Append-only —
// nenhuma rota de negócio edita ou apaga a trilha.
// ============================================================================

export interface AuditInput {
  action: string; // ex.: auth.login, auth.refresh_reuse, tenant.created
  tenantId?: string | null;
  userId?: string | null;
  entity?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditRequestInfo {
  ip?: string;
  userAgent?: string;
}

export class AuditService {
  constructor(private readonly prisma: PrismaClient) {}

  async record(input: AuditInput, req?: AuditRequestInfo): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        action: input.action,
        tenantId: input.tenantId ?? null,
        userId: input.userId ?? null,
        entity: input.entity,
        entityId: input.entityId,
        ip: req?.ip,
        userAgent: req?.userAgent,
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }
}

export function requestAuditInfo(req: {
  ip: string | undefined;
  headers: Record<string, unknown>;
}): AuditRequestInfo {
  const ua = req.headers['user-agent'];
  return {
    ip: req.ip,
    userAgent: typeof ua === 'string' ? ua : undefined,
  };
}
