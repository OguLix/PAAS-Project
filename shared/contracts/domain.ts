import { z } from 'zod';
import type { ApplicationDeploymentConfig } from '../types/api';

/**
 * Input schemas shared by the Express validation layer and client-side forms.
 * Domain-level requests only; transport envelopes live in contracts/api.ts.
 */

const BLOCKED_HOST_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.lan',
  '.home',
  '.arpa',
  '.invalid',
  '.test',
  '.example',
];

type Ipv4Address = [number, number, number, number];

function parseIpv4(hostname: string): Ipv4Address | null {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (!match) {
    return null;
  }

  const octets = match.slice(1).map(Number);
  if (octets.length !== 4 || octets.some((octet) => octet < 0 || octet > 255)) {
    return null;
  }

  return [octets[0]!, octets[1]!, octets[2]!, octets[3]!];
}

function isBlockedIpv4([a, b, c, d]: Ipv4Address): boolean {
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224 ||
    (a === 255 && b === 255 && c === 255 && d === 255)
  );
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  const unbracketed = host.replace(/^\[/, '').replace(/\]$/, '');

  if (unbracketed === 'localhost' || unbracketed === 'metadata.google.internal') {
    return true;
  }
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => unbracketed.endsWith(suffix))) {
    return true;
  }

  const ipv4 = parseIpv4(unbracketed);
  if (ipv4) {
    return isBlockedIpv4(ipv4);
  }

  if (unbracketed === '::' || unbracketed === '::1') {
    return true;
  }
  if (/^f[cd][0-9a-f]{2}:/.test(unbracketed)) {
    return true;
  }
  if (/^fe[89ab][0-9a-f]:/.test(unbracketed)) {
    return true;
  }
  if (unbracketed.startsWith('::ffff:')) {
    const mapped = unbracketed.slice('::ffff:'.length);
    const mappedIpv4 = parseIpv4(mapped);
    return mappedIpv4 ? isBlockedIpv4(mappedIpv4) : true;
  }

  return false;
}

/**
 * The MVP supports public HTTPS repositories only, so credentials, non-HTTPS
 * schemes, non-443 ports and private/link-local hosts are rejected here rather
 * than deeper in the worker. The worker must repeat this check before a build.
 */
export const repositoryUrlSchema = z
  .string()
  .trim()
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
    if (parsed.port && parsed.port !== '443') {
      ctx.addIssue({
        code: 'custom',
        message: 'Public repositories must use the default HTTPS port',
      });
    }
    if (isBlockedHost(parsed.hostname)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Repository host must be a public hostname, not a private or local address',
      });
    }
    if (!parsed.hostname.includes('.') && !parsed.hostname.includes(':')) {
      ctx.addIssue({
        code: 'custom',
        message: 'Repository host must be a fully qualified public hostname',
      });
    }
  });

export const branchNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .regex(
    /^[A-Za-z0-9._/-]+$/,
    'Branch names may only contain letters, digits, dot, dash, underscore and slash',
  )
  .refine(
    (value) =>
      !value.includes('..') &&
      !value.includes('@{') &&
      !value.includes('//') &&
      !value.startsWith('/') &&
      !value.endsWith('/') &&
      !value.endsWith('.') &&
      !value.endsWith('.lock') &&
      !value.split('/').some((part) => part.startsWith('.')),
    'Branch name is not a valid Git ref',
  );

export const commitShaSchema = z
  .string()
  .regex(/^[0-9a-f]{7,64}$/i, 'Commit SHA must be hexadecimal');

export const applicationNameSchema = z.string().trim().min(1).max(120);

const relativeBuildPathSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .regex(
    /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]+$/,
    'Path must stay inside the repository',
  );

export const applicationDeploymentConfigSchema = z.object({
  dockerfilePath: relativeBuildPathSchema,
  buildContext: relativeBuildPathSchema,
  internalPort: z.number().int().min(1).max(65535),
  healthCheckPath: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .regex(/^\/(?!\/)/, 'Health check path must start with a single slash'),
  cpuCores: z.number().min(0.1).max(2),
  memoryMb: z.number().int().min(64).max(2048),
  pidsLimit: z.number().int().min(16).max(512),
});

export const applicationDeploymentConfigInputSchema = applicationDeploymentConfigSchema.partial();

export const DEFAULT_APPLICATION_CONFIG = {
  dockerfilePath: 'Dockerfile',
  buildContext: '.',
  internalPort: 3000,
  healthCheckPath: '/',
  cpuCores: 0.5,
  memoryMb: 512,
  pidsLimit: 100,
} as const satisfies ApplicationDeploymentConfig;

export const createApplicationInputSchema = z
  .object({
    name: applicationNameSchema,
    sourceRepository: repositoryUrlSchema,
    defaultBranch: branchNameSchema,
  })
  .extend(applicationDeploymentConfigInputSchema.shape)
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

export const deployInputSchema = z
  .object({
    branch: branchNameSchema.optional(),
    commitSha: commitShaSchema.optional(),
  })
  .strict();

export const idempotencyKeySchema = z
  .string()
  .min(8)
  .max(128)
  .regex(
    /^[A-Za-z0-9._:-]+$/,
    'Idempotency keys may only contain letters, digits, dot, dash, underscore and colon',
  );

/** Platform-managed variables. User values must not override these. */
export const RESERVED_ENVIRONMENT_VARIABLE_KEYS = [
  'PATH',
  'HOME',
  'PWD',
  'SHELL',
  'USER',
  'LOGNAME',
  'HOST',
  'HOSTNAME',
  'PORT',
  'NODE_ENV',
  'NODE_OPTIONS',
  'NODE_PATH',
  'LD_PRELOAD',
  'LD_LIBRARY_PATH',
] as const;

const reservedEnvironmentVariableKeys = new Set<string>(RESERVED_ENVIRONMENT_VARIABLE_KEYS);

export const environmentVariableKeySchema = z
  .string()
  .regex(/^[A-Z][A-Z0-9_]{0,127}$/, 'Keys must look like CONSTANT_CASE identifiers')
  .refine(
    (key) => !reservedEnvironmentVariableKeys.has(key) && !key.startsWith('OGULIX_'),
    'Key is reserved by the platform',
  );

export const environmentVariableValueSchema = z.string().max(8192);

export const environmentVariableInputSchema = z
  .object({
    value: environmentVariableValueSchema,
    isSecret: z.boolean().default(true),
  })
  .strict();

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
export type ApplicationDeploymentConfigInput = z.infer<
  typeof applicationDeploymentConfigInputSchema
>;
