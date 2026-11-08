import { z } from 'zod';

/**
 * BullMQ job contract shared by the API producer and the worker.
 * Jobs carry identifiers and validated options only; never secrets or
 * arbitrary shell commands.
 */
export const DEPLOYMENT_QUEUE_NAME = 'deployments';

export const DEPLOY_JOB_NAME = 'deploy';
export const STOP_JOB_NAME = 'stop';
export const RESTART_JOB_NAME = 'restart';

export const DEPLOYMENT_JOB_NAMES = [DEPLOY_JOB_NAME, STOP_JOB_NAME, RESTART_JOB_NAME] as const;

export type DeploymentJobName = (typeof DEPLOYMENT_JOB_NAMES)[number];

const identifierSchema = z.string().min(1).max(64);
const revisionSchema = z.string().min(1).max(255);

const basePayloadSchema = z.object({
  deploymentId: identifierSchema,
  applicationId: identifierSchema,
  requestedByUserId: identifierSchema,
  /** Correlation id from the HTTP request that created the job. */
  requestId: z.string().min(1).max(64).optional(),
});

export const deployJobPayloadSchema = basePayloadSchema
  .extend({
    kind: z.literal('deploy'),
    sourceBranch: revisionSchema.optional(),
    sourceRevision: revisionSchema.optional(),
  })
  .strict();

export const stopJobPayloadSchema = basePayloadSchema
  .extend({
    kind: z.literal('stop'),
  })
  .strict();

export const restartJobPayloadSchema = basePayloadSchema
  .extend({
    kind: z.literal('restart'),
  })
  .strict();

export const deploymentJobPayloadSchema = z.discriminatedUnion('kind', [
  deployJobPayloadSchema,
  stopJobPayloadSchema,
  restartJobPayloadSchema,
]);

export type DeployJobPayload = z.infer<typeof deployJobPayloadSchema>;
export type StopJobPayload = z.infer<typeof stopJobPayloadSchema>;
export type RestartJobPayload = z.infer<typeof restartJobPayloadSchema>;
export type DeploymentJobPayload = z.infer<typeof deploymentJobPayloadSchema>;

export function isDeployJob(payload: unknown): payload is DeployJobPayload {
  return deployJobPayloadSchema.safeParse(payload).success;
}

export function isStopJob(payload: unknown): payload is StopJobPayload {
  return stopJobPayloadSchema.safeParse(payload).success;
}

export function isRestartJob(payload: unknown): payload is RestartJobPayload {
  return restartJobPayloadSchema.safeParse(payload).success;
}

export function parseDeploymentJobPayload(payload: unknown): DeploymentJobPayload {
  return deploymentJobPayloadSchema.parse(payload);
}
