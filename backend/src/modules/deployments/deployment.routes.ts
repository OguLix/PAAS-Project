import { Router } from 'express';
import {
  deployInputSchema,
  idempotencyKeySchema,
  logQuerySchema,
  opaqueIdSchema,
  paginationQuerySchema,
} from '@ogulix/shared';
import type { AuthService } from '../auth/auth.service';
import type { AppEnv } from '../../config/env';
import { getAuthContext } from '../../common/auth/get-auth-context';
import { requireAuth } from '../../common/auth/require-auth';
import { HttpError } from '../../common/errors/http-error';
import { listResponse, successResponse } from '../../common/http/response';
import { parseInput } from '../../common/validation/parse-input';
import type { DeploymentService } from './deployment.service';

export function createDeploymentRouter(
  authService: AuthService,
  deploymentService: DeploymentService,
  env: AppEnv,
): Router {
  const router = Router();
  const authenticate = requireAuth(authService, env.SESSION_COOKIE_NAME);

  router.get(
    '/applications/:applicationId/deployments',
    authenticate,
    async (request, response) => {
      const applicationId = parseInput(opaqueIdSchema, request.params.applicationId);
      const { page, pageSize } = parseInput(paginationQuerySchema, request.query);
      const result = await deploymentService.listByApplication(
        getAuthContext(request),
        applicationId,
        page,
        pageSize,
      );
      response.json(
        listResponse(result.deployments, response.locals.requestId as string, {
          page,
          pageSize,
          total: result.total,
        }),
      );
    },
  );

  router.post(
    '/applications/:applicationId/deployments',
    authenticate,
    async (request, response) => {
      const applicationId = parseInput(opaqueIdSchema, request.params.applicationId);
      const rawKey = request.get('idempotency-key');
      if (!rawKey) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Idempotency-Key header is required', [
          {
            field: 'Idempotency-Key',
            code: 'required',
            message: 'Idempotency-Key header is required',
          },
        ]);
      }

      const idempotencyKey = parseInput(idempotencyKeySchema, rawKey);
      const input = parseInput(deployInputSchema, request.body ?? {});
      const requestId = response.locals.requestId as string;
      const deployment = await deploymentService.create(
        getAuthContext(request),
        applicationId,
        input,
        idempotencyKey,
        requestId,
      );
      response.status(202).json(successResponse(deployment, requestId));
    },
  );

  router.get('/applications/:applicationId/logs', authenticate, async (request, response) => {
    const applicationId = parseInput(opaqueIdSchema, request.params.applicationId);
    const query = parseInput(logQuerySchema, request.query);
    const entries = await deploymentService.listApplicationLogs(
      getAuthContext(request),
      applicationId,
      query,
    );
    response.json(successResponse(entries, response.locals.requestId as string));
  });

  router.get('/deployments/:deploymentId', authenticate, async (request, response) => {
    const deploymentId = parseInput(opaqueIdSchema, request.params.deploymentId);
    const deployment = await deploymentService.get(getAuthContext(request), deploymentId);
    response.json(successResponse(deployment, response.locals.requestId as string));
  });

  router.get('/deployments/:deploymentId/logs', authenticate, async (request, response) => {
    const deploymentId = parseInput(opaqueIdSchema, request.params.deploymentId);
    const query = parseInput(logQuerySchema, request.query);
    const entries = await deploymentService.listDeploymentLogs(
      getAuthContext(request),
      deploymentId,
      query,
    );
    response.json(successResponse(entries, response.locals.requestId as string));
  });

  router.post('/deployments/:deploymentId/cancel', authenticate, async (request, response) => {
    const deploymentId = parseInput(opaqueIdSchema, request.params.deploymentId);
    const requestId = response.locals.requestId as string;
    const deployment = await deploymentService.cancel(
      getAuthContext(request),
      deploymentId,
      requestId,
    );
    response.status(202).json(successResponse(deployment, requestId));
  });

  router.post('/deployments/:deploymentId/stop', authenticate, async (request, response) => {
    const deploymentId = parseInput(opaqueIdSchema, request.params.deploymentId);
    const requestId = response.locals.requestId as string;
    const deployment = await deploymentService.stop(
      getAuthContext(request),
      deploymentId,
      requestId,
    );
    response.status(202).json(successResponse(deployment, requestId));
  });

  router.post('/deployments/:deploymentId/restart', authenticate, async (request, response) => {
    const deploymentId = parseInput(opaqueIdSchema, request.params.deploymentId);
    const requestId = response.locals.requestId as string;
    const deployment = await deploymentService.restart(
      getAuthContext(request),
      deploymentId,
      requestId,
    );
    response.status(202).json(successResponse(deployment, requestId));
  });

  return router;
}
