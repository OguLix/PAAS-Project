import { Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import { DEPLOYMENT_QUEUE_NAME } from '../queues/deployment.queue';
import { logger } from '../logging';

export function createDeploymentProcessor(_redis: Redis) {
  const worker = new Worker(
    DEPLOYMENT_QUEUE_NAME,
    async (job) => {
      logger.info('deployment job received', {
        jobId: job.id,
        jobName: job.name,
      });
      // Scaffold: no processing logic yet.
      throw new Error('Deployment processor not implemented in scaffold');
    },
    {
      connection: _redis,
      concurrency: 1,
    },
  );

  worker.on('failed', (job, error) => {
    logger.error('deployment job failed', {
      jobId: job?.id,
      error: error.message,
    });
  });

  return worker;
}
