import 'dotenv/config';
import { DEPLOYMENT_STATUSES, NODE_COMMANDS } from '@ogulix/shared';
import { loadEnv } from './config/env';
import { logger, setLogLevel } from './logging';

const env = loadEnv();
setLogLevel(env.LOG_LEVEL);

logger.info('worker starting', {
  environment: env.NODE_ENV,
  runtimeMode: env.RUNTIME_MODE,
  queue: env.QUEUE_NAME,
  concurrency: env.WORKER_CONCURRENCY,
  deploymentStatuses: DEPLOYMENT_STATUSES.length,
  nodeCommands: NODE_COMMANDS.length,
  queueConfigured: Boolean(env.REDIS_URL),
});

const idleTimer = setInterval(() => {
  logger.debug('worker idle', { queue: env.QUEUE_NAME });
}, 60000);

function shutdown(signal: NodeJS.Signals): void {
  logger.info('worker stopping', { signal });
  clearInterval(idleTimer);
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
