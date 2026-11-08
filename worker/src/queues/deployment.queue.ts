import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { DEPLOYMENT_QUEUE_NAME, type DeploymentJobPayload } from '@ogulix/shared';

export {
  DEPLOYMENT_QUEUE_NAME,
  DEPLOY_JOB_NAME,
  RESTART_JOB_NAME,
  STOP_JOB_NAME,
  isDeployJob,
  isRestartJob,
  isStopJob,
} from '@ogulix/shared';
export type {
  DeploymentJobName,
  DeploymentJobPayload,
  DeployJobPayload,
  RestartJobPayload,
  StopJobPayload,
} from '@ogulix/shared';

export function createDeploymentQueue(
  redis: Redis,
  queueName: string = DEPLOYMENT_QUEUE_NAME,
): Queue<DeploymentJobPayload> {
  return new Queue<DeploymentJobPayload>(queueName, {
    connection: redis,
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: false,
    },
  });
}
