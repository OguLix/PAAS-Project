import { Router } from 'express';
import {
  environmentVariableInputSchema,
  environmentVariableKeySchema,
  opaqueIdSchema,
} from '@ogulix/shared';
import type { AuthService } from '../auth/auth.service';
import type { AppEnv } from '../../config/env';
import { getAuthContext } from '../../common/auth/get-auth-context';
import { requireAuth } from '../../common/auth/require-auth';
import { successResponse } from '../../common/http/response';
import { parseInput } from '../../common/validation/parse-input';
import type { EnvironmentVariableService } from './env.service';

export function createEnvironmentVariableRouter(
  authService: AuthService,
  envService: EnvironmentVariableService,
  env: AppEnv,
): Router {
  const router = Router();
  const authenticate = requireAuth(authService, env.SESSION_COOKIE_NAME);

  router.get('/applications/:applicationId/env', authenticate, async (request, response) => {
    const applicationId = parseInput(opaqueIdSchema, request.params.applicationId);
    const variables = await envService.list(getAuthContext(request), applicationId);
    response.json(successResponse(variables, response.locals.requestId as string));
  });

  router.put('/applications/:applicationId/env/:key', authenticate, async (request, response) => {
    const applicationId = parseInput(opaqueIdSchema, request.params.applicationId);
    const key = parseInput(environmentVariableKeySchema, request.params.key);
    const input = parseInput(environmentVariableInputSchema, request.body);
    const requestId = response.locals.requestId as string;
    const variable = await envService.upsert(
      getAuthContext(request),
      applicationId,
      key,
      input,
      requestId,
    );
    response.json(successResponse(variable, requestId));
  });

  router.delete(
    '/applications/:applicationId/env/:key',
    authenticate,
    async (request, response) => {
      const applicationId = parseInput(opaqueIdSchema, request.params.applicationId);
      const key = parseInput(environmentVariableKeySchema, request.params.key);
      const requestId = response.locals.requestId as string;
      const result = await envService.remove(
        getAuthContext(request),
        applicationId,
        key,
        requestId,
      );
      response.json(successResponse(result, requestId));
    },
  );

  return router;
}
