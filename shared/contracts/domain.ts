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

    const authority = value.slice(value.indexOf('://') + 3).split(/[/?#]/, 1)[0];
    if (parsed.protocol !== 'https:') {
      ctx.addIssue({ code: 'custom', message: 'Only the https protocol is supported' });
    }
    if (parsed.username.length > 0 || parsed.password.length > 0 || authority?.includes('@')) {
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

export const createApplicationInputSchema = z
  .object({
    name: applicationNameSchema,
    sourceRepository: repositoryUrlSchema,
    defaultBranch: branchNameSchema,
  })
  .strict();

export const updateApplicationInputSchema = createApplicationInputSchema
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field must be provided');

export const emailSchema = z
  .string()
  .trim()
  .email()
  .max(255)
  .transform((value) => value.toLowerCase());

export const passwordSchema = z.string().min(8).max(256);

export const registerInputSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
  })
  .strict();

export const loginInputSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(256),
  })
  .strict();

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
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.apps\.ogulix\.tech$/,
    'Hostname must be a single subdomain of apps.ogulix.tech',
  );

export const createDomainInputSchema = z
  .object({
    hostname: domainHostnameSchema,
  })
  .strict();

export type CreateApplicationInput = z.infer<typeof createApplicationInputSchema>;
export type UpdateApplicationInput = z.infer<typeof updateApplicationInputSchema>;
export type RegisterInput = z.infer<typeof registerInputSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;
export type DeployInput = z.infer<typeof deployInputSchema>;
export type CreateDomainInput = z.infer<typeof createDomainInputSchema>;
export type EnvironmentVariableInput = z.infer<typeof environmentVariableInputSchema>;
export type ResourceLimits = z.infer<typeof resourceLimitsSchema>;
