import 'dotenv/config';
import Redis from 'ioredis';
import { DEPLOYMENT_STATUSES, NODE_COMMANDS } from '@ogulix/shared';
import { loadEnv } from './config/env';
import { logger, setLogLevel } from './logging';

/**
 * Worker entry point.
 *
 * Scope: process wiring only. It validates configuration and proves that the
 * queue backend is reachable. Registering a BullMQ processor is deliberately
 * out of scope for this change; `RUNTIME_MODE` is a worker runtime setting and
 * is unrelated to the dashboard Mock API.
 */
const env = loadEnv();
setLogLevel(env.LOG_LEVEL);

const REDIS_CONNECT_ATTEMPTS = 30;
const REDIS_RETRY_DELAY_MS = 2000;

let connection: Redis | null = null;
let idleTimer: NodeJS.Timeout | null = null;
let stopping = false;

logger.info('worker starting', {
  environment: env.NODE_ENV,
  runtimeMode: env.RUNTIME_MODE,
  queue: env.QUEUE_NAME,
  concurrency: env.WORKER_CONCURRENCY,
  deploymentStatuses: DEPLOYMENT_STATUSES.length,
  nodeCommands: NODE_COMMANDS.length,
  queueConfigured: Boolean(env.REDIS_URL),
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function connectToQueue(url: string): Promise<boolean> {
  for (let attempt = 1; attempt <= REDIS_CONNECT_ATTEMPTS; attempt += 1) {
    if (stopping) {
      return false;
    }

    const client = new Redis(url, {
      lazyConnect: true,
      // Fail fast: the retry loop below owns the backoff so the log stays readable.
      retryStrategy: () => null,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });

    client.on('error', (error: Error) => {
      logger.warn('redis client error', { attempt, error: error.name });
    });

    try {
      await client.connect();
      const pong = await client.ping();

      connection = client;
      logger.info('worker queue connection ready', { queue: env.QUEUE_NAME, pong });
      return true;
    } catch (error) {
      client.disconnect();
      logger.warn('redis connection attempt failed', {
        attempt,
        maxAttempts: REDIS_CONNECT_ATTEMPTS,
        error: error instanceof Error ? error.name : 'UnknownError',
      });
      await sleep(REDIS_RETRY_DELAY_MS);
    }
  }

  return false;
}

async function start(): Promise<void> {
  if (env.REDIS_URL) {
    const connected = await connectToQueue(env.REDIS_URL);

    if (!connected) {
      logger.error('worker cannot reach redis, exiting', {
        attempts: REDIS_CONNECT_ATTEMPTS,
        queue: env.QUEUE_NAME,
      });
      process.exitCode = 1;
      return;
    }
  } else {
    logger.warn('worker queue connection skipped', { reason: 'REDIS_URL is not configured' });
  }

  idleTimer = setInterval(() => {
    logger.debug('worker idle', { queue: env.QUEUE_NAME });
  }, 60000);
}

function shutdown(signal: NodeJS.Signals): void {
  if (stopping) {
    return;
  }

  stopping = true;
  logger.info('worker stopping', { signal });

  if (idleTimer) {
    clearInterval(idleTimer);
    idleTimer = null;
  }

  const client = connection;
  connection = null;

  if (!client) {
    process.exit(0);
  }

  void client
    .quit()
    .catch((error: unknown) => {
      logger.warn('redis disconnect failed', {
        error: error instanceof Error ? error.name : 'UnknownError',
      });
    })
    .finally(() => {
      process.exit(0);
    });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

void start();
