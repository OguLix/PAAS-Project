import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';

export const DEPLOYMENT_QUEUE_NAME = 'deployments';

export type DeployJobPayload = {
  deploymentId: string;
  applicationId: string;
  requestedByUserId: string;
  sourceRevision?: string;
};

export type StopJobPayload = {
  deploymentId: string;
  applicationId: string;
  requestedByUserId: string;
};

export type RestartJobPayload = {
  deploymentId: string;
  applicationId: string;
  requestedByUserId: string;
};

export type DeploymentJobPayload = DeployJobPayload | StopJobPayload | RestartJobPayload;

export function createDeploymentQueue(redis: Redis): Queue<DeploymentJobPayload> {
  return new Queue<DeploymentJobPayload>(DEPLOYMENT_QUEUE_NAME, {
    connection: redis,
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: false,
    },
  });
}
