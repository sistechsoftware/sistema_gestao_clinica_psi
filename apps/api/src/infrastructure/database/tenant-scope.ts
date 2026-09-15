import type { PrismaClient } from '@prisma/client';
import { ForbiddenError, NotFoundError } from '../../shared/errors.js';

// ============================================================================
// TenantScopeExtension (doc 01 R3; §37): o tenant vem SEMPRE do contexto
// autenticado (JWT → TenantUser), nunca do frontend. Esta extensão injeta
// tenantId em toda operação sobre modelos tenanted:
//   - leituras/count/aggregate/groupBy → where com AND obrigatório no tenantId
//   - create/createMany                → data.tenantId (ignora valor do cliente)
//   - update/delete/upsert             → locate-then-act: localiza no tenant
//                                        (findFirst AND) e age por id único
//   - updateMany/deleteMany sem filtro → bloqueado
//
// IMPORTANTE (correção do vazamento R3): findUnique/update/delete/upsert usam
// UniqueWhere, que no Prisma tem semântica OR entre campos únicos —
// where { id, tenantId } casa o registro pelo ID mesmo em OUTRO tenant.
// Por isso: findUnique é executado como findFirst (AND), e writes de registro
// único só ocorrem após localizar o registro DENTRO do tenant.
//
// Chamadas internas usam o client base (`raw`), sem reentrar na extensão.
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

/** AND obrigatório: a condição do contexto prevalece sobre qualquer where. */
function scopedReadWhere(userWhere: AnyArgs | undefined, tenantId: string): AnyArgs {
  return { AND: [userWhere ?? {}], tenantId };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function delegateOf(raw: PrismaClient, model: string): any {
  return (raw as unknown as Record<string, unknown>)[model];
}

export function createScopedPrisma(raw: PrismaClient, ctx: TenantScopeContext): ScopedPrismaClient {
  return raw.$extends({
    name: 'TenantScope',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // O Prisma entrega o nome em PascalCase ('Patient'); nossa lista é camelCase.
          const scopedModel = model ? model.charAt(0).toLowerCase() + model.slice(1) : undefined;
          if (!scopedModel || !(TENANTED_MODELS as readonly string[]).includes(scopedModel)) {
            return query(args);
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const a = (args ?? {}) as AnyArgs;
          const delegate = delegateOf(raw, scopedModel);
          const { tenantId } = ctx;

          switch (operation) {
            // ----------------------------------------------------------------
            // Leituras: findUnique tem where único (semântica OR) → rodamos
            // como findFirst/findFirstOrThrow com AND obrigatório.
            // ----------------------------------------------------------------
            case 'findUnique': {
              return delegate.findFirst({ ...a, where: scopedReadWhere(a.where, tenantId) });
            }
            case 'findUniqueOrThrow': {
              return delegate.findFirstOrThrow({ ...a, where: scopedReadWhere(a.where, tenantId) });
            }
            case 'findFirst':
            case 'findFirstOrThrow':
            case 'findMany':
            case 'count':
            case 'aggregate':
            case 'groupBy': {
              return query({ ...a, where: scopedReadWhere(a.where, tenantId) });
            }

            // ----------------------------------------------------------------
            // Criação: tenantId SEMPRE do contexto.
            // ----------------------------------------------------------------
            case 'create': {
              return query({ ...a, data: { ...(a.data ?? {}), tenantId } });
            }
            case 'createMany':
            case 'createManyAndReturn': {
              const data = Array.isArray(a.data)
                ? a.data.map((d: AnyArgs) => ({ ...d, tenantId }))
                : { ...(a.data ?? {}), tenantId };
              return query({ ...a, data });
            }

            // ----------------------------------------------------------------
            // Bulk: exige filtro explícito + AND do tenant.
            // ----------------------------------------------------------------
            case 'updateMany':
            case 'deleteMany': {
              if (a.where == null || Object.keys(a.where).length === 0) {
                throw new ForbiddenError('Bulk operations require an explicit filter');
              }
              return query({ ...a, where: scopedReadWhere(a.where, tenantId) });
            }

            // ----------------------------------------------------------------
            // Registro único: locate-then-act (o registro deve existir NESTE
            // tenant; senão → 404, sem revelar existência cross-tenant).
            // ----------------------------------------------------------------
            case 'update':
            case 'delete': {
              const found = await delegate.findFirst({
                where: scopedReadWhere(a.where, tenantId),
                select: { id: true },
              });
              if (!found) throw new NotFoundError(`${scopedModel} not found`);
              return query({ ...a, where: { id: found.id } });
            }

            case 'upsert': {
              const found = await delegate.findFirst({
                where: scopedReadWhere(a.where, tenantId),
                select: { id: true },
              });
              if (found) {
                // update nunca pode mover o registro para outro tenant
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const update: AnyArgs = { ...(a.update ?? {}) };
                delete update.tenantId;
                return query({
                  ...a,
                  where: { id: found.id },
                  update,
                  create: { ...(a.create ?? {}), tenantId },
                });
              }
              // Não existe neste tenant → cria (create já impõe tenantId).
              // Conflito de unique (ex.: id de outro tenant) → P2002 → 409.
              return delegate.create({ data: { ...(a.create ?? {}), tenantId } });
            }

            default:
              return query(a);
          }
        },
      },
    },
  }) as ScopedPrismaClient;
}
