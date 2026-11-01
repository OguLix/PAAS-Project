import 'dotenv/config';
import { Prisma } from '@prisma/client';
import { createApp } from './app';
import { loadEnv } from './config/env';
import { logger, setLogLevel } from './common/logger';
import { PrismaApplicationRepository } from './infrastructure/database/prisma-application.repository';
import { PrismaAuthRepository } from './infrastructure/database/prisma-auth.repository';
import { createPrismaClient } from './infrastructure/database/prisma-client';
import { PrismaDomainRepository } from './infrastructure/database/prisma-domain.repository';
import { ApplicationService } from './modules/applications/application.service';
import { AuthService } from './modules/auth/auth.service';
import { DomainService } from './modules/domains/domain.service';

const env = loadEnv();
setLogLevel(env.LOG_LEVEL);

if (!env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be configured before starting the API');
}

const prisma = createPrismaClient(env.DATABASE_URL);
const authRepository = new PrismaAuthRepository(prisma);
const applicationRepository = new PrismaApplicationRepository(prisma);
const domainRepository = new PrismaDomainRepository(prisma);
const applicationService = new ApplicationService(applicationRepository);
const authService = new AuthService(authRepository, env);
const domainService = new DomainService(domainRepository, applicationService);

const app = createApp(env, {
  authService,
  applicationService,
  domainService,
  checkDatabase: async () => {
    await prisma.$queryRaw(Prisma.sql`SELECT 1`);
  },
});

const server = app.listen(env.API_PORT, () => {
  logger.info('api listening', { port: env.API_PORT, environment: env.NODE_ENV });
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

    void prisma
      .$disconnect()
      .then(() => {
        if (error) {
          process.exitCode = 1;
        }
      })
      .catch((disconnectError: unknown) => {
        logger.error('database disconnect failed', {
          error: disconnectError instanceof Error ? disconnectError.name : 'UnknownError',
        });
        process.exitCode = 1;
      });
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
