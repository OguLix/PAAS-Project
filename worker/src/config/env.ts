import { z } from 'zod';
import { parseEncryptionKey } from '@ogulix/shared/server/crypto';

/**
 * Worker configuration. Build concurrency is one in the MVP
 * (docs/design/decisions.md), so the default is not a tunable knob yet.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  RUNTIME_MODE: z.enum(['mock', 'iaas']).default('mock'),

  REDIS_URL: z.string().min(1).optional(),
  DATABASE_URL: z.string().min(1).optional(),
  ENV_ENCRYPTION_KEY: z
    .string()
    .min(1)
    .optional()
    .refine((value) => {
      if (!value) {
        return true;
      }
      try {
        parseEncryptionKey(value);
        return true;
      } catch {
        return false;
      }
    }, 'ENV_ENCRYPTION_KEY must be base64-encoded 32 bytes'),

  QUEUE_NAME: z.string().min(1).max(64).default('deployments'),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(1).default(1),
});

export type WorkerEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): WorkerEnv {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join('.') || '(root)').join(', ');
    throw new Error(`Invalid worker environment configuration for: ${fields}`);
  }

  return parsed.data;
}
