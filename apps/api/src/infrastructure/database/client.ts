import { PrismaClient } from '@prisma/client';

import type { ScopedPrismaClient } from './tenant-scope.js';

// ============================================================================
// Prisma client singleton. O client "scopeado" (por tenant) é criado pela
// TenantScopeExtension (tenant-scope.ts) e é o único que casos de uso devem
// usar para modelos tenanted — nunca o client cru.
//
// Sem dependência de env na construção: módulos podem ser importados em
// coleta de testes sem DATABASE_URL (suites pulam); queries reais validam
// a configuração no primeiro acesso.
// ============================================================================

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function getRawPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const hasUrl = /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? '');
    globalForPrisma.prisma = new PrismaClient({
      datasources: hasUrl ? undefined : { db: { url: 'postgresql://localhost:5432/unconfigured' } },
      log: process.env.PRISMA_DEBUG === '1' ? ['query', 'error', 'warn'] : ['error', 'warn'],
    });
  }
  return globalForPrisma.prisma;
}

export type { ScopedPrismaClient };
