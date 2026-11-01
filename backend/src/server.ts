import 'dotenv/config';
import { createApp } from './app';
import { loadEnv } from './config/env';
import { logger, setLogLevel } from './common/logger';

const env = loadEnv();
setLogLevel(env.LOG_LEVEL);

const app = createApp(env);

const server = app.listen(env.API_PORT, () => {
  logger.info('api listening', { port: env.API_PORT, environment: env.NODE_ENV });
});

function shutdown(signal: NodeJS.Signals): void {
  logger.info('shutting down', { signal });

  server.close((error) => {
    if (error) {
      logger.error('shutdown failed', { error: error.name });
      process.exitCode = 1;
    }
    process.exit();
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
