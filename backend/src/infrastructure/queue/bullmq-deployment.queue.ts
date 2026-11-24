import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import {
  DEPLOYMENT_QUEUE_NAME,
  DEPLOY_JOB_NAME,
  RESTART_JOB_NAME,
  STOP_JOB_NAME,
  type DeploymentJobPayload,
} from '@ogulix/shared';
import type { DeploymentQueueProducer } from '../../modules/deployments/deployment.queue';

function jobNameForPayload(payload: DeploymentJobPayload): string {
  switch (payload.kind) {
    case 'deploy':
      return DEPLOY_JOB_NAME;
    case 'stop':
      return STOP_JOB_NAME;
    case 'restart':
      return RESTART_JOB_NAME;
  }
}

export class BullMqDeploymentQueue implements DeploymentQueueProducer {
  private readonly queue: Queue<DeploymentJobPayload>;

  constructor(redis: Redis, queueName: string = DEPLOYMENT_QUEUE_NAME) {
    this.queue = new Queue<DeploymentJobPayload>(queueName, {
      connection: redis,
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: false,
      },
    });
  }

  async enqueue(payload: DeploymentJobPayload): Promise<void> {
    await this.queue.add(jobNameForPayload(payload), payload, {
      jobId: `${payload.kind}-${payload.deploymentId}`,
    });
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}
