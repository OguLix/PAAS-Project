import { randomUUID } from 'node:crypto';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import type { HealthResponse, ReadinessCheck, ReadinessResponse } from '@ogulix/shared';
import type { AppEnv } from './config/env';
import { errorResponse, successResponse } from './common/http/response';
import { logger } from './common/logger';

/**
 * Scaffold application: request plumbing plus health and readiness only.
 * Authentication, applications, deployments and node routes are intentionally
 * not implemented in this milestone.
 */
export function createApp(env: AppEnv): express.Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));

  app.use((_req: Request, res: Response, next: NextFunction) => {
    const requestId = randomUUID();
    res.locals.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  });

  app.get('/api/v1/health', (_req: Request, res: Response) => {
    const body: HealthResponse = {
      status: 'ok',
      service: 'ogulix-api',
      uptimeSeconds: Math.round(process.uptime()),
    };

    res.status(200).json(successResponse(body, res.locals.requestId as string));
  });

  app.get('/api/v1/ready', (_req: Request, res: Response) => {
    const checks: ReadinessCheck[] = [
      {
        name: 'database',
        ready: Boolean(env.DATABASE_URL),
        ...(env.DATABASE_URL ? {} : { detail: 'DATABASE_URL is not configured' }),
      },
      {
        name: 'queue',
        ready: Boolean(env.REDIS_URL),
        ...(env.REDIS_URL ? {} : { detail: 'REDIS_URL is not configured' }),
      },
    ];

    const body: ReadinessResponse = {
      ready: checks.every((check) => check.ready),
      checks,
    };

    res.status(body.ready ? 200 : 503).json(successResponse(body, res.locals.requestId as string));
  });

  app.use((req: Request, res: Response) => {
    res
      .status(404)
      .json(
        errorResponse(
          'NOT_FOUND',
          `No route for ${req.method} ${req.path}`,
          res.locals.requestId as string,
        ),
      );
  });

  app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    logger.error('unhandled request error', {
      path: req.path,
      requestId: res.locals.requestId,
      error: error instanceof Error ? error.name : 'UnknownError',
    });

    if (res.headersSent) {
      return;
    }

    res
      .status(500)
      .json(errorResponse('INTERNAL_ERROR', 'Unexpected error', res.locals.requestId as string));
  });

  return app;
}
