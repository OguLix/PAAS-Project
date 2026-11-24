import { Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import {
  DEPLOYMENT_QUEUE_NAME,
  parseDeploymentJobPayload,
  type DeploymentJobPayload,
} from '@ogulix/shared';
import { logger } from '../logging';
import type { DeploymentOrchestrator } from '../services/deployment-orchestrator';

export type DeploymentProcessorOptions = {
  queueName?: string;
  concurrency?: number;
};

export function createDeploymentProcessor(
  redis: Redis,
  orchestrator: DeploymentOrchestrator,
  options: DeploymentProcessorOptions = {},
): Worker<DeploymentJobPayload> {
  const queueName = options.queueName ?? DEPLOYMENT_QUEUE_NAME;
  const concurrency = options.concurrency ?? 1;

  const worker = new Worker<DeploymentJobPayload>(
    queueName,
    async (job) => {
      const payload = parseDeploymentJobPayload(job.data);
      logger.info('processing deployment job', {
        jobId: job.id,
        jobName: job.name,
        kind: payload.kind,
        deploymentId: payload.deploymentId,
        requestId: payload.requestId,
      });

      switch (payload.kind) {
        case 'deploy':
          await orchestrator.executeDeploy(payload);
          break;
        case 'stop':
          await orchestrator.executeStop(payload);
          break;
        case 'restart':
          await orchestrator.executeRestart(payload);
          break;
      }
    },
    {
      connection: redis,
      concurrency,
    },
  );

  worker.on('failed', (job, error) => {
    logger.error('deployment job failed', {
      jobId: job?.id,
      error: error.name,
    });
  });

  return worker;
}
