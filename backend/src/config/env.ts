import { z } from 'zod';

/**
 * Environment schema. Defaults keep the scaffold runnable without a database,
 * but readiness reports 503 until the real services are configured.
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    APP_ORIGIN: z.url().default('http://localhost:3000'),

    DATABASE_URL: z.string().min(1).optional(),
    REDIS_URL: z.string().min(1).optional(),

    SESSION_COOKIE_NAME: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,64}$/)
      .default('ogulix_session'),
    SESSION_TTL_HOURS: z.coerce
      .number()
      .int()
      .min(1)
      .max(24 * 7)
      .default(24 * 7),
    SESSION_IDLE_HOURS: z.coerce.number().int().min(1).max(24).default(24),
    REGISTRATION_MODE: z.enum(['open', 'closed']).default('closed'),

    ENV_ENCRYPTION_KEY: z.string().min(1).optional(),
  })
  .superRefine((env, context) => {
    const origin = new URL(env.APP_ORIGIN);
    if (origin.protocol !== 'http:' && origin.protocol !== 'https:') {
      context.addIssue({
        code: 'custom',
        path: ['APP_ORIGIN'],
        message: 'APP_ORIGIN must use HTTP or HTTPS',
      });
    }
    if (origin.pathname !== '/' || origin.search || origin.hash) {
      context.addIssue({
        code: 'custom',
        path: ['APP_ORIGIN'],
        message: 'APP_ORIGIN must not contain a path, query, or fragment',
      });
    }
    if (env.NODE_ENV === 'production' && origin.protocol !== 'https:') {
      context.addIssue({
        code: 'custom',
        path: ['APP_ORIGIN'],
        message: 'APP_ORIGIN must use HTTPS in production',
      });
    }
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
