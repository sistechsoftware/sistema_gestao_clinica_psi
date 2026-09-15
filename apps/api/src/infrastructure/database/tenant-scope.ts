import type { PrismaClient } from '@prisma/client';
import { ForbiddenError } from '../../shared/errors.js';

// ============================================================================
// TenantScopeExtension (doc 01 R3; §37): o tenant vem SEMPRE do contexto
// autenticado (JWT → TenantUser), nunca do frontend. Esta extensão injeta
// tenantId em toda operação sobre modelos tenanted:
//   - leituras/listas  → where.tenantId
//   - create           → data.tenantId (ignora valor do cliente)
//   - update/delete    → where.tenantId (+ upsert.create)
//   - updateMany/deleteMany sem where explícito → bloqueado
// `patientContact` não tem coluna própria: é escopado transitivamente via
// Patient (acesso sempre pelo agregado raiz — coberto por testes).
// Limitação conhecida: writes aninhados em relações (nested) não passam por
// aqui; módulos devem operar na raiz tenanted. Testes de isolamento cobrem.
// ============================================================================

export const TENANTED_MODELS = [
  'patient',
  'clinicalRecord',
  'clinicalNote',
  'availabilitySlot',
  'availabilityBlock',
  'appointment',
  'appointmentSeries',
  'waitlistEntry',
  'package',
  'packageSession',
  'accountReceivable',
  'accountPayable',
  'payment',
  'paymentAllocation',
  'documentTemplate',
  'document',
  'notification',
  'notificationQueue',
  'notificationDelivery',
  'notificationPreference',
  'communicationLog',
  'pushSubscription',
  'setting',
] as const;

export type TenantedModel = (typeof TENANTED_MODELS)[number];

export interface TenantScopeContext {
  tenantId: string;
  userId: string;
}

/** Client com escopo de tenant ativo — tipos permanecem PrismaClient. */
export type ScopedPrismaClient = PrismaClient;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyArgs = Record<string, any>;

export function createScopedPrisma(raw: PrismaClient, ctx: TenantScopeContext): ScopedPrismaClient {
  return raw.$extends({
    name: 'TenantScope',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !(TENANTED_MODELS as readonly string[]).includes(model)) {
            return query(args);
          }
          return query(scopeArgs(operation, args as AnyArgs | undefined, ctx.tenantId));
        },
      },
    },
  }) as ScopedPrismaClient;
}

function scopeArgs(operation: string, rawArgs: AnyArgs | undefined, tenantId: string): AnyArgs {
  const args: AnyArgs = { ...(rawArgs ?? {}) };

  switch (operation) {
    case 'findUnique':
    case 'findUniqueOrThrow':
    case 'findFirst':
    case 'findFirstOrThrow':
    case 'findMany':
    case 'count':
    case 'aggregate':
    case 'groupBy': {
      args.where = { ...(args.where ?? {}), tenantId };
      break;
    }
    case 'create': {
      args.data = { ...(args.data ?? {}), tenantId };
      break;
    }
    case 'createMany':
    case 'createManyAndReturn': {
      if (Array.isArray(args.data)) {
        args.data = args.data.map((d: AnyArgs) => ({ ...d, tenantId }));
      } else {
        args.data = { ...(args.data ?? {}), tenantId };
      }
      break;
    }
    case 'update':
    case 'updateMany':
    case 'delete':
    case 'deleteMany':
    case 'upsert': {
      if (
        (operation === 'updateMany' || operation === 'deleteMany') &&
        (args.where == null || Object.keys(args.where).length === 0)
      ) {
        throw new ForbiddenError('Bulk operations require an explicit filter');
      }
      args.where = { ...(args.where ?? {}), tenantId };
      if (operation === 'upsert') {
        args.create = { ...(args.create ?? {}), tenantId };
      }
      break;
    }
    default:
      break;
  }
  return args;
}
