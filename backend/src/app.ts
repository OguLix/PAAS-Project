import { randomUUID } from 'node:crypto';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import type { HealthResponse, ReadinessCheck, ReadinessResponse } from '@ogulix/shared';
import type { AppEnv } from './config/env';
import { errorResponse, successResponse } from './common/http/response';
import { HttpError } from './common/errors/http-error';
import { logger } from './common/logger';
import { createApplicationRouter } from './modules/applications/application.routes';
import type { ApplicationService } from './modules/applications/application.service';
import { createAuthRouter } from './modules/auth/auth.routes';
import type { AuthService } from './modules/auth/auth.service';
import { createDomainRouter } from './modules/domains/domain.routes';
import type { DomainService } from './modules/domains/domain.service';

export type AppDependencies = {
  authService: AuthService;
  applicationService: ApplicationService;
  domainService: DomainService;
  checkDatabase: () => Promise<void>;
};

function isMutatingMethod(method: string): boolean {
  return method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
}

function originGuard(env: AppEnv): express.RequestHandler {
  const expectedOrigin = new URL(env.APP_ORIGIN).origin;
  return (request, response, next) => {
    if (!request.path.startsWith('/api/v1/') || !isMutatingMethod(request.method)) {
      next();
      return;
    }

    const fetchSite = request.get('sec-fetch-site');
    const requestOrigin = request.get('origin');
    const originMatches = requestOrigin !== undefined && requestOrigin === expectedOrigin;
    const sameOriginFetch = requestOrigin === undefined && fetchSite === 'same-origin';
    const fetchMetadataMatches =
      fetchSite === undefined ||
      fetchSite === 'same-origin' ||
      (fetchSite === 'same-site' && originMatches);

    if ((!originMatches && !sameOriginFetch) || !fetchMetadataMatches) {
      next(new HttpError(403, 'FORBIDDEN', 'Request origin is not allowed'));
      return;
    }

    next();
  };
}

function corsForDashboard(env: AppEnv): express.RequestHandler {
  const expectedOrigin = new URL(env.APP_ORIGIN).origin;
  const allowedMethods = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
  const allowedHeaders = new Set(['content-type', 'idempotency-key']);

  return (request, response, next) => {
    const requestOrigin = request.get('origin');
    if (requestOrigin !== expectedOrigin) {
      if (request.method === 'OPTIONS' && request.get('access-control-request-method')) {
        next(new HttpError(403, 'FORBIDDEN', 'Request origin is not allowed'));
        return;
      }
      next();
      return;
    }

    response.setHeader('access-control-allow-origin', expectedOrigin);
    response.setHeader('access-control-allow-credentials', 'true');
    response.setHeader('access-control-max-age', '600');
    response.vary('Origin');
    response.vary('Access-Control-Request-Method');
    response.vary('Access-Control-Request-Headers');

    if (request.method !== 'OPTIONS' || !request.get('access-control-request-method')) {
      next();
      return;
    }

    const requestedMethod = request.get('access-control-request-method')?.toUpperCase();
    const requestedHeaders = (request.get('access-control-request-headers') ?? '')
      .split(',')
      .map((header) => header.trim().toLowerCase())
      .filter(Boolean);

    if (
      !requestedMethod ||
      !allowedMethods.includes(requestedMethod) ||
      requestedHeaders.some((header) => !allowedHeaders.has(header))
    ) {
      next(new HttpError(403, 'FORBIDDEN', 'CORS preflight request is not allowed'));
      return;
    }

    response.setHeader('access-control-allow-methods', allowedMethods.join(', '));
    if (requestedHeaders.length > 0) {
      response.setHeader('access-control-allow-headers', requestedHeaders.join(', '));
    }
    response.status(204).end();
  };
}

export function createApp(env: AppEnv, dependencies: AppDependencies): express.Express {
  const app = express();

  app.disable('x-powered-by');
  app.use((_request: Request, response: Response, next: NextFunction) => {
    const requestId = randomUUID();
    response.locals.requestId = requestId;
    response.setHeader('x-request-id', requestId);
    response.setHeader('cache-control', 'no-store');
    response.setHeader('x-content-type-options', 'nosniff');
    response.setHeader('referrer-policy', 'no-referrer');
    next();
  });
  app.use(corsForDashboard(env));
  app.use(originGuard(env));
  app.use(express.json({ limit: '256kb', strict: true }));

  app.get('/api/v1/health', (_request: Request, response: Response) => {
    const body: HealthResponse = {
      status: 'ok',
      service: 'ogulix-api',
      uptimeSeconds: Math.round(process.uptime()),
      runtimeMode: env.RUNTIME_MODE,
    };

    response.status(200).json(successResponse(body, response.locals.requestId as string));
  });

  app.get('/api/v1/ready', async (_request: Request, response: Response) => {
    let databaseReady = false;
    try {
      await dependencies.checkDatabase();
      databaseReady = true;
    } catch (error) {
      logger.warn('database readiness check failed', {
        requestId: response.locals.requestId,
        error: error instanceof Error ? error.name : 'UnknownError',
      });
    }

    const checks: ReadinessCheck[] = [
      {
        name: 'database',
        ready: databaseReady,
        ...(databaseReady ? {} : { detail: 'Database is unavailable' }),
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

    response
      .status(body.ready ? 200 : 503)
      .json(successResponse(body, response.locals.requestId as string));
  });

  app.use('/api/v1/auth', createAuthRouter(dependencies.authService, env));
  app.use('/api/v1', createDomainRouter(dependencies.authService, dependencies.domainService, env));
  app.use(
    '/api/v1/applications',
    createApplicationRouter(dependencies.authService, dependencies.applicationService, env),
  );

  app.use((request: Request, response: Response) => {
    response
      .status(404)
      .json(
        errorResponse(
          'NOT_FOUND',
          `No route for ${request.method} ${request.path}`,
          response.locals.requestId as string,
        ),
      );
  });

  app.use((error: unknown, request: Request, response: Response, _next: NextFunction) => {
    if (response.headersSent) {
      return;
    }

    if (error instanceof HttpError) {
      response
        .status(error.status)
        .json(
          errorResponse(
            error.code,
            error.message,
            response.locals.requestId as string,
            error.details,
          ),
        );
      return;
    }

    if (error instanceof SyntaxError && 'status' in error && error.status === 400) {
      response
        .status(400)
        .json(
          errorResponse(
            'VALIDATION_ERROR',
            'Request body contains invalid JSON',
            response.locals.requestId as string,
          ),
        );
      return;
    }

    if (typeof error === 'object' && error !== null && 'status' in error && error.status === 413) {
      response
        .status(413)
        .json(
          errorResponse(
            'VALIDATION_ERROR',
            'Request body exceeds the allowed size',
            response.locals.requestId as string,
          ),
        );
      return;
    }

    logger.error('unhandled request error', {
      path: request.path,
      requestId: response.locals.requestId,
      error: error instanceof Error ? error.name : 'UnknownError',
    });

    response
      .status(500)
      .json(
        errorResponse('INTERNAL_ERROR', 'Unexpected error', response.locals.requestId as string),
      );
  });

  return app;
}
