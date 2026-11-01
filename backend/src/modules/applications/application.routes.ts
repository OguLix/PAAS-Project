import { Router } from 'express';
import {
  createApplicationInputSchema,
  opaqueIdSchema,
  paginationQuerySchema,
  updateApplicationInputSchema,
} from '@ogulix/shared';
import type { AuthService } from '../auth/auth.service';
import type { AppEnv } from '../../config/env';
import { requireAuth } from '../../common/auth/require-auth';
import { getAuthContext } from '../../common/auth/get-auth-context';
import { listResponse, successResponse } from '../../common/http/response';
import { parseInput } from '../../common/validation/parse-input';
import type { ApplicationService } from './application.service';

export function createApplicationRouter(
  authService: AuthService,
  applicationService: ApplicationService,
  env: AppEnv,
): Router {
  const router = Router();
  router.use(requireAuth(authService, env.SESSION_COOKIE_NAME));

  router.get('/', async (request, response) => {
    const { page, pageSize } = parseInput(paginationQuerySchema, request.query);
    const result = await applicationService.list(getAuthContext(request), page, pageSize);
    response.json(
      listResponse(result.applications, response.locals.requestId as string, {
        page,
        pageSize,
        total: result.total,
      }),
    );
  });

  router.post('/', async (request, response) => {
    const input = parseInput(createApplicationInputSchema, request.body);
    const application = await applicationService.create(getAuthContext(request), input);
    response.status(201).json(successResponse(application, response.locals.requestId as string));
  });

  router.get('/:applicationId', async (request, response) => {
    const applicationId = parseInput(opaqueIdSchema, request.params.applicationId);
    const application = await applicationService.get(getAuthContext(request), applicationId);
    response.json(successResponse(application, response.locals.requestId as string));
  });

  router.patch('/:applicationId', async (request, response) => {
    const applicationId = parseInput(opaqueIdSchema, request.params.applicationId);
    const input = parseInput(updateApplicationInputSchema, request.body);
    const application = await applicationService.update(
      getAuthContext(request),
      applicationId,
      input,
    );
    response.json(successResponse(application, response.locals.requestId as string));
  });

  router.delete('/:applicationId', async (request, response) => {
    const applicationId = parseInput(opaqueIdSchema, request.params.applicationId);
    const application = await applicationService.archive(getAuthContext(request), applicationId);
    response.json(successResponse(application, response.locals.requestId as string));
  });

  return router;
}
