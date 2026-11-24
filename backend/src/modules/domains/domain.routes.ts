import { Router } from 'express';
import { createDomainInputSchema, opaqueIdSchema } from '@ogulix/shared';
import type { AuthService } from '../auth/auth.service';
import type { AppEnv } from '../../config/env';
import { getAuthContext } from '../../common/auth/get-auth-context';
import { requireAuth } from '../../common/auth/require-auth';
import { successResponse } from '../../common/http/response';
import { parseInput } from '../../common/validation/parse-input';
import type { DomainService } from './domain.service';

export function createDomainRouter(
  authService: AuthService,
  domainService: DomainService,
  env: AppEnv,
): Router {
  const router = Router();
  const authenticate = requireAuth(authService, env.SESSION_COOKIE_NAME);

  router.get('/applications/:applicationId/domains', authenticate, async (request, response) => {
    const applicationId = parseInput(opaqueIdSchema, request.params.applicationId);
    const domains = await domainService.list(getAuthContext(request), applicationId);
    response.json(successResponse(domains, response.locals.requestId as string));
  });

  router.post('/applications/:applicationId/domains', authenticate, async (request, response) => {
    const applicationId = parseInput(opaqueIdSchema, request.params.applicationId);
    const input = parseInput(createDomainInputSchema, request.body);
    const requestId = response.locals.requestId as string;
    const domain = await domainService.create(
      getAuthContext(request),
      applicationId,
      input,
      requestId,
    );
    response.status(201).json(successResponse(domain, requestId));
  });

  router.delete('/domains/:domainId', authenticate, async (request, response) => {
    const domainId = parseInput(opaqueIdSchema, request.params.domainId);
    const requestId = response.locals.requestId as string;
    const domain = await domainService.disable(getAuthContext(request), domainId, requestId);
    response.json(successResponse(domain, requestId));
  });

  return router;
}
