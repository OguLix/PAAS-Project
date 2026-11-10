import 'dotenv/config';
import Redis from 'ioredis';
import { DEPLOYMENT_STATUSES, NODE_COMMANDS } from '@ogulix/shared';
import { loadEnv } from './config/env';
import { logger, setLogLevel } from './logging';

/**
 * Worker entry point.
 *
 * Scope: process wiring and queue connectivity only. Registering a BullMQ
 * processor is deliberately out of scope. `RUNTIME_MODE` is a worker runtime
 * setting and is unrelated to the dashboard Mock API, which no longer exists.
 *
 * Connection policy:
 * - exactly one Redis client, never one per attempt;
 * - reconnects use a bounded budget with exponential backoff;
 * - when the budget is exhausted the process exits non-zero so the container
 *   restart policy can recover it instead of staying up without a queue.
 */
const env = loadEnv();
setLogLevel(env.LOG_LEVEL);

const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 5000;
const CONNECT_TIMEOUT_MS = 5000;
const IDLE_LOG_INTERVAL_MS = 60000;

let connection: Redis | null = null;
let idleTimer: NodeJS.Timeout | null = null;
let stopping = false;
let ready = false;
let reconnectAttempts = 0;

logger.info('worker starting', {
  environment: env.NODE_ENV,
  runtimeMode: env.RUNTIME_MODE,
  queue: env.QUEUE_NAME,
  concurrency: env.WORKER_CONCURRENCY,
  deploymentStatuses: DEPLOYMENT_STATUSES.length,
  nodeCommands: NODE_COMMANDS.length,
  queueConfigured: Boolean(env.REDIS_URL),
});

function reconnectDelayMs(attempt: number): number {
  return Math.min(BASE_RECONNECT_DELAY_MS * 2 ** (attempt - 1), MAX_RECONNECT_DELAY_MS);
}

/**
 * Exits non-zero when the queue connection cannot be recovered. Docker restarts
 * the container, which re-runs the bounded startup sequence.
 */
function stopWithFailure(reason: string): void {
  ready = false;
  logger.error('worker exiting without a queue connection', {
    reason,
    queue: env.QUEUE_NAME,
  });
  process.exit(1);
}

function createClient(url: string): Redis {
  const client = new Redis(url, {
    lazyConnect: true,
    connectTimeout: CONNECT_TIMEOUT_MS,
    maxRetriesPerRequest: 1,
    // Nothing is queued locally: no processor is registered yet, and failing
    // fast is safer than replaying stale commands after a long outage.
    enableOfflineQueue: false,
    retryStrategy: (attempt) => {
      if (stopping) {
        return null;
      }

      if (attempt > MAX_RECONNECT_ATTEMPTS) {
        logger.error('queue reconnect budget exhausted', {
          attempts: MAX_RECONNECT_ATTEMPTS,
          queue: env.QUEUE_NAME,
        });
        return null;
      }

      reconnectAttempts = attempt;
      const delayMs = reconnectDelayMs(attempt);

      logger.warn('queue reconnect scheduled', {
        attempt,
        maxAttempts: MAX_RECONNECT_ATTEMPTS,
        delayMs,
        queue: env.QUEUE_NAME,
      });

      return delayMs;
    },
  });

  client.on('ready', () => {
    ready = true;
    reconnectAttempts = 0;
    logger.info('worker queue connection ready', { queue: env.QUEUE_NAME });
  });

  client.on('reconnecting', () => {
    ready = false;
    logger.debug('queue client reconnecting', {
      attempt: reconnectAttempts,
      queue: env.QUEUE_NAME,
    });
  });

  client.on('close', () => {
    if (ready) {
      logger.warn('queue connection closed', { queue: env.QUEUE_NAME });
    }
    ready = false;
  });

  client.on('end', () => {
    ready = false;

    if (stopping) {
      return;
    }

    stopWithFailure('the queue connection ended without recovering');
  });

  client.on('error', (error: Error) => {
    // The URL carries credentials, so only the error identity is logged.
    logger.warn('queue client error', {
      error: error.name,
      code: (error as NodeJS.ErrnoException).code ?? 'UNKNOWN',
      queue: env.QUEUE_NAME,
    });
  });

  return client;
}

/** Resolves true on `ready`, false on `end`. */
function waitForReady(client: Redis): Promise<boolean> {
  if (client.status === 'ready') {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const onReady = (): void => {
      cleanup();
      resolve(true);
    };

    const onEnd = (): void => {
      cleanup();
      resolve(false);
    };

    function cleanup(): void {
      client.off('ready', onReady);
      client.off('end', onEnd);
    }

    client.once('ready', onReady);
    client.once('end', onEnd);
  });
}

async function start(): Promise<void> {
  if (!env.REDIS_URL) {
    logger.warn('worker queue connection skipped', { reason: 'REDIS_URL is not configured' });
  } else {
    const client = createClient(env.REDIS_URL);
    connection = client;

    // Listen before connecting so the first `ready`/`end` cannot be missed.
    const becameReady = waitForReady(client);

    void client.connect().catch((error: unknown) => {
      logger.debug('initial queue connection attempt failed', {
        error: error instanceof Error ? error.name : 'UnknownError',
        queue: env.QUEUE_NAME,
      });
    });

    const connected = await becameReady;

    if (!connected) {
      // The `end` handler owns the exit; nothing else should keep running.
      return;
    }

    try {
      const pong = await client.ping();
      logger.info('worker queue verified', { pong, queue: env.QUEUE_NAME });
    } catch (error) {
      stopWithFailure(error instanceof Error ? error.name : 'QueuePingFailed');
      return;
    }
  }

  idleTimer = setInterval(() => {
    logger.debug('worker idle', { queue: env.QUEUE_NAME });
  }, IDLE_LOG_INTERVAL_MS);
}

function shutdown(signal: NodeJS.Signals): void {
  if (stopping) {
    return;
  }

  stopping = true;
  ready = false;
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
      logger.warn('queue disconnect failed', {
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
