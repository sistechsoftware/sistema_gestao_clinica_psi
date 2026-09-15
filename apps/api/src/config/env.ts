import { z } from 'zod';

/**
 * Config validada por Zod (§38, §54 — nada hardcoded; fail-fast no primeiro
 * acesso). Parsing lazy: permite importar módulos em coleta de testes sem
 * env (suites sem banco pulam); em produção, o primeiro uso valida e aborta.
 */
const schema = z.object({
  NODE_ENV: z.enum(['test', 'development', 'production']).default('development'),
  APP_ENV: z.enum(['local', 'development', 'staging', 'production']).default('local'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  WEB_URL: z.url().default('http://localhost:5173'),
  API_URL: z.url().default('http://localhost:3000'),

  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'must be a postgres:// URL'),
  DIRECT_URL: z
    .string()
    .regex(/^postgres(ql)?:\/\//, 'must be a postgres:// URL')
    .optional(),

  JWT_SECRET: z.string().min(32, 'use at least 32 chars'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  /** base64 de 32 bytes (AES-256) — chave mestra de cifragem de campo */
  AES_MASTER_KEY: z.string().min(44),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(300),
  RATE_LIMIT_TIME_WINDOW: z.string().default('1 minute'),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().min(1).default(5),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (!cached) {
    const result = schema.safeParse(process.env);
    if (!result.success) {
      const details = result.error.issues
        .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('\n');
      throw new Error(`Invalid environment variables:\n${details}\nSee .env.example`);
    }
    cached = result.data;
  }
  return cached;
}

/** Proxy lazy: mantém `env.PORT` ergonômico sem quebrar imports de teste. */
export const env: Env = new Proxy({} as Env, {
  get(_target, prop) {
    if (prop === 'then') return undefined; // nunca thenable
    return getEnv()[prop as keyof Env];
  },
});
