import { z } from 'zod';

/**
 * Input schemas shared by the Express validation layer and client-side forms.
 * Domain-level requests only; transport envelopes live in contracts/api.ts.
 */

/**
 * The MVP supports public HTTPS repositories only, so credentials and any
 * non-HTTPS scheme are rejected here rather than deeper in the worker.
 */
export const repositoryUrlSchema = z
  .string()
  .min(1)
  .max(2048)
  .superRefine((value, ctx) => {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Repository must be an absolute HTTPS URL' });
      return;
    }

    if (parsed.protocol !== 'https:') {
      ctx.addIssue({ code: 'custom', message: 'Only the https protocol is supported' });
    }
    if (parsed.username.length > 0 || parsed.password.length > 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'Credentials in the repository URL are not allowed',
      });
    }
  });

export const branchNameSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(
    /^[A-Za-z0-9._/-]+$/,
    'Branch names may only contain letters, digits, dot, dash, underscore and slash',
  );

export const commitShaSchema = z
  .string()
  .regex(/^[0-9a-f]{7,64}$/i, 'Commit SHA must be hexadecimal');

export const applicationNameSchema = z.string().trim().min(1).max(120);

export const createApplicationInputSchema = z.object({
  name: applicationNameSchema,
  sourceRepository: repositoryUrlSchema,
  defaultBranch: branchNameSchema,
});

export const updateApplicationInputSchema = createApplicationInputSchema.partial();

export const deployInputSchema = z.object({
  branch: branchNameSchema.optional(),
  commitSha: commitShaSchema.optional(),
});

export const idempotencyKeySchema = z
  .string()
  .min(8)
  .max(128)
  .regex(
    /^[A-Za-z0-9._:-]+$/,
    'Idempotency keys may only contain letters, digits, dot, dash, underscore and colon',
  );

export const environmentVariableKeySchema = z
  .string()
  .regex(/^[A-Z][A-Z0-9_]{0,127}$/, 'Keys must look like CONSTANT_CASE identifiers');

export const environmentVariableValueSchema = z.string().max(8192);

export const environmentVariableInputSchema = z.object({
  value: environmentVariableValueSchema,
  isSecret: z.boolean().default(true),
});

/** Defaults match docs/design/decisions.md section 9. */
export const resourceLimitsSchema = z.object({
  cpuCores: z.number().min(0.1).max(2).default(0.5),
  memoryMb: z.number().int().min(64).max(2048).default(512),
  pidsLimit: z.number().int().min(16).max(512).default(100),
});

export const domainHostnameSchema = z
  .string()
  .min(3)
  .max(253)
  .regex(
    /^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/,
    'Hostname must be a lowercase DNS name',
  );

export type CreateApplicationInput = z.infer<typeof createApplicationInputSchema>;
export type UpdateApplicationInput = z.infer<typeof updateApplicationInputSchema>;
export type DeployInput = z.infer<typeof deployInputSchema>;
export type EnvironmentVariableInput = z.infer<typeof environmentVariableInputSchema>;
export type ResourceLimits = z.infer<typeof resourceLimitsSchema>;
