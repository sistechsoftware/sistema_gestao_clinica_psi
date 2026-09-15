import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { DomainError } from './errors.js';

// ============================================================================
// Error handler central (doc 02 §2): DomainError → status correto;
// P2025 (não encontrado) → 404, para não revelar recursos de outros tenants.
// ============================================================================

interface ErrorBody {
  error: { code: string; message: string };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function prismaCode(err: unknown): string | undefined {
  if (isRecord(err) && typeof err['code'] === 'string') {
    return err['code'].startsWith('P') ? err['code'] : undefined;
  }
  return undefined;
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((err: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    if (err instanceof DomainError) {
      const body: ErrorBody = { error: { code: err.code, message: err.message } };
      reply.status(err.status).send(body);
      return;
    }

    if (err instanceof ZodError) {
      reply.status(400).send({
        error: {
          code: 'VALIDATION',
          message: 'Invalid request payload',
        },
      });
      request.log.debug({ issues: err.issues }, 'zod validation issues');
      return;
    }

    const code = prismaCode(err);
    if (code === 'P2025') {
      // Registros de outros tenants não existem para o chamador (isolation tests)
      reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Resource not found' } });
      return;
    }
    if (code === 'P2002') {
      reply.status(409).send({ error: { code: 'CONFLICT', message: 'Resource already exists' } });
      return;
    }
    if (code === 'P2003') {
      reply
        .status(409)
        .send({ error: { code: 'CONFLICT', message: 'Related resource constraint violated' } });
      return;
    }

    const statusCode = typeof err.statusCode === 'number' ? err.statusCode : 500;
    if (statusCode < 500) {
      // erros de framework (ex.: JSON inválido, rate limit já customizado)
      reply.status(statusCode).send({ error: { code: 'BAD_REQUEST', message: err.message } });
      return;
    }

    request.log.error({ err }, 'unhandled error');
    reply.status(500).send({
      error: { code: 'INTERNAL', message: 'Internal server error' },
    });
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });
}
