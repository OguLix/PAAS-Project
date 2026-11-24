import 'dotenv/config';
import Redis from 'ioredis';
import { Prisma } from '@prisma/client';
import { createApp } from './app';
import { loadEnv } from './config/env';
import { logger, setLogLevel } from './common/logger';
import { PrismaApplicationRepository } from './infrastructure/database/prisma-application.repository';
import { PrismaAuditRepository } from './infrastructure/database/prisma-audit.repository';
import { PrismaAuthRepository } from './infrastructure/database/prisma-auth.repository';
import { createPrismaClient } from './infrastructure/database/prisma-client';
import { PrismaDeploymentRepository } from './infrastructure/database/prisma-deployment.repository';
import { PrismaDomainRepository } from './infrastructure/database/prisma-domain.repository';
import { PrismaEnvironmentVariableRepository } from './infrastructure/database/prisma-env.repository';
import { PrismaNodeRepository } from './infrastructure/database/prisma-node.repository';
import { BullMqDeploymentQueue } from './infrastructure/queue/bullmq-deployment.queue';
import { ApplicationService } from './modules/applications/application.service';
import { AuthService } from './modules/auth/auth.service';
import type { DeploymentQueueProducer } from './modules/deployments/deployment.queue';
import { DeploymentService } from './modules/deployments/deployment.service';
import { DomainService } from './modules/domains/domain.service';
import { EnvironmentVariableService } from './modules/env/env.service';
import { NodeService } from './modules/nodes/node.service';

const env = loadEnv();
setLogLevel(env.LOG_LEVEL);

if (!env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be configured before starting the API');
}

const prisma = createPrismaClient(env.DATABASE_URL);
const auditRepository = new PrismaAuditRepository(prisma);
const authRepository = new PrismaAuthRepository(prisma);
const applicationRepository = new PrismaApplicationRepository(prisma);
const domainRepository = new PrismaDomainRepository(prisma);
const deploymentRepository = new PrismaDeploymentRepository(prisma);
const envRepository = new PrismaEnvironmentVariableRepository(prisma);
const nodeRepository = new PrismaNodeRepository(prisma);

let redis: Redis | null = null;
let deploymentQueue: DeploymentQueueProducer;

if (env.REDIS_URL) {
  redis = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    connectTimeout: 5000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  redis.on('error', (error: Error) => {
    logger.warn('api queue client error', {
      error: error.name,
      code: (error as NodeJS.ErrnoException).code ?? 'UNKNOWN',
    });
  });
  void redis.connect().catch((error: unknown) => {
    logger.warn('initial api queue connection failed', {
      error: error instanceof Error ? error.name : 'UnknownError',
    });
  });
  deploymentQueue = new BullMqDeploymentQueue(redis, env.QUEUE_NAME);
} else {
  deploymentQueue = {
    async enqueue() {
      throw new Error('REDIS_URL is not configured');
    },
  };
}

const applicationService = new ApplicationService(applicationRepository, auditRepository);
const authService = new AuthService(authRepository, env);
const domainService = new DomainService(domainRepository, applicationService, auditRepository);
const deploymentService = new DeploymentService(
  deploymentRepository,
  applicationService,
  deploymentQueue,
  auditRepository,
);
const envService = new EnvironmentVariableService(
  envRepository,
  applicationService,
  env,
  auditRepository,
);
const nodeService = new NodeService(nodeRepository);

const app = createApp(env, {
  authService,
  applicationService,
  domainService,
  deploymentService,
  envService,
  nodeService,
  checkDatabase: async () => {
    await prisma.$queryRaw(Prisma.sql`SELECT 1`);
  },
  checkQueue: async () => {
    if (!redis) {
      throw new Error('REDIS_URL is not configured');
    }
    const pong = await redis.ping();
    if (pong !== 'PONG') {
      throw new Error('Unexpected Redis PING response');
    }
  },
});

const server = app.listen(env.API_PORT, () => {
  logger.info('api listening', {
    port: env.API_PORT,
    environment: env.NODE_ENV,
    runtimeMode: env.RUNTIME_MODE,
  });
});

let shuttingDown = false;
function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  logger.info('shutting down', { signal });

  server.close((error) => {
    if (error) {
      logger.error('shutdown failed', { error: error.name });
      process.exitCode = 1;
    }

    const cleanupTasks: Promise<unknown>[] = [prisma.$disconnect()];
    if (deploymentQueue.close) {
      cleanupTasks.push(deploymentQueue.close());
    }
    if (redis) {
      cleanupTasks.push(redis.quit());
    }

    void Promise.allSettled(cleanupTasks).then((results) => {
      for (const result of results) {
        if (result.status === 'rejected') {
          logger.error('cleanup failed during shutdown', {
            error: result.reason instanceof Error ? result.reason.name : 'UnknownError',
          });
          process.exitCode = 1;
        }
      }
    });
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
