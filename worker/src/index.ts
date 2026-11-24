import 'dotenv/config';
import type { Worker } from 'bullmq';
import Redis from 'ioredis';
import type { PrismaClient } from '@prisma/client';
import { DEPLOYMENT_STATUSES, NODE_COMMANDS, type DeploymentJobPayload } from '@ogulix/shared';
import { createPrismaClient } from '@ogulix/shared/server/prisma';
import { BuildkitAdapter } from './adapters/buildkit.adapter';
import { DockerAdapter } from './adapters/docker.adapter';
import { MockSshAdapter, SshAdapter } from './adapters/ssh.adapter';
import { MockTraefikConfigAdapter, TraefikConfigAdapter } from './adapters/traefik-config.adapter';
import { loadEnv } from './config/env';
import { logger, setLogLevel } from './logging';
import { createDeploymentProcessor } from './processors/deployment.processor';
import { PrismaWorkerDeploymentRepository } from './repositories/prisma-deployment.repository';
import { BuildService } from './services/build-service';
import { DeploymentOrchestrator } from './services/deployment-orchestrator';
import { HealthCheckService } from './services/health-check-service';
import { NodeScheduler } from './services/node-scheduler';

const env = loadEnv();
setLogLevel(env.LOG_LEVEL);

const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 5000;
const CONNECT_TIMEOUT_MS = 5000;
const IDLE_LOG_INTERVAL_MS = 60000;

let connection: Redis | null = null;
let bullConnection: Redis | null = null;
let bullWorker: Worker<DeploymentJobPayload> | null = null;
let prisma: PrismaClient | null = null;
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
  databaseConfigured: Boolean(env.DATABASE_URL),
});

function reconnectDelayMs(attempt: number): number {
  return Math.min(BASE_RECONNECT_DELAY_MS * 2 ** (attempt - 1), MAX_RECONNECT_DELAY_MS);
}

function stopWithFailure(reason: string): void {
  ready = false;
  logger.error('worker exiting without a queue connection', {
    reason,
    queue: env.QUEUE_NAME,
  });
  process.exit(1);
}

function createProbeClient(url: string): Redis {
  const client = new Redis(url, {
    lazyConnect: true,
    connectTimeout: CONNECT_TIMEOUT_MS,
    maxRetriesPerRequest: 1,
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
    logger.warn('queue client error', {
      error: error.name,
      code: (error as NodeJS.ErrnoException).code ?? 'UNKNOWN',
      queue: env.QUEUE_NAME,
    });
  });

  return client;
}

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
    const client = createProbeClient(env.REDIS_URL);
    connection = client;

    const becameReady = waitForReady(client);

    void client.connect().catch((error: unknown) => {
      logger.debug('initial queue connection attempt failed', {
        error: error instanceof Error ? error.name : 'UnknownError',
        queue: env.QUEUE_NAME,
      });
    });

    const connected = await becameReady;

    if (!connected) {
      return;
    }

    try {
      const pong = await client.ping();
      logger.info('worker queue verified', { pong, queue: env.QUEUE_NAME });
    } catch (error) {
      stopWithFailure(error instanceof Error ? error.name : 'QueuePingFailed');
      return;
    }

    if (env.DATABASE_URL) {
      prisma = createPrismaClient(env.DATABASE_URL);
      const repository = new PrismaWorkerDeploymentRepository(prisma);
      const transport = env.RUNTIME_MODE === 'mock' ? new MockSshAdapter() : new SshAdapter();
      const traefik =
        env.RUNTIME_MODE === 'mock' ? new MockTraefikConfigAdapter() : new TraefikConfigAdapter();
      const orchestrator = new DeploymentOrchestrator(
        repository,
        new NodeScheduler(),
        new BuildService(new BuildkitAdapter(transport)),
        new DockerAdapter(transport),
        new HealthCheckService(env.RUNTIME_MODE),
        traefik,
        { encryptionKey: env.ENV_ENCRYPTION_KEY },
      );

      // BullMQ blocking workers require maxRetriesPerRequest: null.
      bullConnection = new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: null,
        connectTimeout: CONNECT_TIMEOUT_MS,
      });
      bullConnection.on('error', (error: Error) => {
        logger.warn('bullmq redis connection error', {
          error: error.name,
          code: (error as NodeJS.ErrnoException).code ?? 'UNKNOWN',
        });
      });

      bullWorker = createDeploymentProcessor(bullConnection, orchestrator, {
        queueName: env.QUEUE_NAME,
        concurrency: env.WORKER_CONCURRENCY,
      });
      logger.info('deployment processor registered', {
        queue: env.QUEUE_NAME,
        concurrency: env.WORKER_CONCURRENCY,
        runtimeMode: env.RUNTIME_MODE,
      });
    } else {
      logger.warn('deployment processor skipped', { reason: 'DATABASE_URL is not configured' });
    }
  }

  idleTimer = setInterval(() => {
    logger.debug('worker heartbeat', {
      queue: env.QUEUE_NAME,
      processorActive: Boolean(bullWorker),
    });
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

  const cleanupTasks: Promise<unknown>[] = [];
  if (bullWorker) {
    cleanupTasks.push(bullWorker.close());
    bullWorker = null;
  }
  if (bullConnection) {
    cleanupTasks.push(bullConnection.quit());
    bullConnection = null;
  }
  if (connection) {
    cleanupTasks.push(connection.quit());
    connection = null;
  }
  if (prisma) {
    cleanupTasks.push(prisma.$disconnect());
    prisma = null;
  }

  void Promise.allSettled(cleanupTasks).finally(() => {
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

void start();
