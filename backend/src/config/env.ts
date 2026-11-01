import { z } from 'zod';

/**
 * Environment schema. Defaults keep the scaffold runnable without a database,
 * but readiness reports 503 until the real services are configured.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),

  DATABASE_URL: z.string().min(1).optional(),
  REDIS_URL: z.string().min(1).optional(),

  SESSION_COOKIE_NAME: z.string().min(1).max(64).default('ogulix_session'),
  SESSION_TTL_HOURS: z.coerce
    .number()
    .int()
    .min(1)
    .max(24 * 30)
    .default(24 * 7),
  SESSION_IDLE_HOURS: z.coerce
    .number()
    .int()
    .min(1)
    .max(24 * 7)
    .default(24),
  REGISTRATION_MODE: z.enum(['open', 'closed']).default('closed'),

  ENV_ENCRYPTION_KEY: z.string().min(1).optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join('.') || '(root)').join(', ');
    throw new Error(`Invalid environment configuration for: ${fields}`);
  }

  return parsed.data;
}
