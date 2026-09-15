import Fastify, { type FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { env } from './config/env.js';
import { registerErrorHandler } from './shared/error-handler.js';
import { registerAuthPlugin } from './shared/plugins/auth.js';
import { authRoutes } from './modules/auth/routes.js';
import { tenantRoutes } from './modules/tenants/routes.js';
import { getRawPrisma } from './infrastructure/database/client.js';

// ============================================================================
// Composição da aplicação (doc 02 §2/§3). buildApp() é usado por dev, testes
// (app.inject) e produção — sem efeitos colaterais de rede.
// ============================================================================

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      env.NODE_ENV === 'development'
        ? { level: env.LOG_LEVEL, transport: { target: 'pino-pretty' } }
        : { level: env.LOG_LEVEL },
    trustProxy: true,
  });

  // Segurança e infra HTTP (§35)
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: [env.WEB_URL],
    credentials: true,
  });
  await app.register(cookie);
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_TIME_WINDOW,
  });

  // Zod como schema/type provider (§38)
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Erros centralizados + guards de auth
  registerErrorHandler(app);
  await registerAuthPlugin(app);

  // Healthcheck (sem auth)
  app.get('/api/health', async () => {
    await getRawPrisma().$queryRaw`SELECT 1`;
    return { status: 'ok', env: env.APP_ENV, time: new Date().toISOString() };
  });

  // Módulos
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(tenantRoutes, { prefix: '/api/tenants' });

  return app;
}

// ============================================================================
// Bootstrap (apenas execução direta — testes usam buildApp + inject)
// ============================================================================

// Execução direta somente fora do vitest (worker threads sobrescrevem argv).
const isDirectRun =
  process.env.VITEST !== 'true' &&
  process.argv[1] !== undefined &&
  /server\.(ts|js)$/.test(process.argv[1]);

if (isDirectRun) {
  const app = await buildApp();

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'shutting down');
    await app.close();
    await getRawPrisma().$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  app
    .listen({ port: env.API_PORT, host: '0.0.0.0' })
    .then(() => app.log.info(`API on :${env.API_PORT} [${env.APP_ENV}]`))
    .catch((err) => {
      app.log.error(err);
      process.exit(1);
    });
}
