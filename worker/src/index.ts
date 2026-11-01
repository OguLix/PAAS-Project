import 'dotenv/config';
import { DEPLOYMENT_STATUSES, NODE_COMMANDS } from '@ogulix/shared';
import { loadEnv } from './config/env';
import { logger, setLogLevel } from './logging';

const env = loadEnv();
setLogLevel(env.LOG_LEVEL);

/**
 * Scaffold worker.
 *
 * No BullMQ consumer is registered yet: the processor, scheduler and
 * SSH/BuildKit adapters land in the next milestone. The process must not claim
 * jobs it cannot complete, so it starts idle, says so, and stays alive so a
 * process supervisor sees the real lifecycle.
 */
logger.info('worker scaffold ready', {
  environment: env.NODE_ENV,
  queue: env.QUEUE_NAME,
  concurrency: env.WORKER_CONCURRENCY,
  deploymentStatuses: DEPLOYMENT_STATUSES.length,
  nodeCommands: NODE_COMMANDS.length,
  queueConfigured: Boolean(env.REDIS_URL),
});

logger.warn('no deployment processor registered; the worker will not consume jobs', {
  queue: env.QUEUE_NAME,
});

// Placeholder for the future BullMQ Worker handle, which is what will keep the
// event loop alive once processors exist.
const idleTimer = setInterval(() => {
  logger.debug('worker idle', { queue: env.QUEUE_NAME });
}, 60_000);

function shutdown(signal: NodeJS.Signals): void {
  logger.info('worker stopping', { signal });
  clearInterval(idleTimer);
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
