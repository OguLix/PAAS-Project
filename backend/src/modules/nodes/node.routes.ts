import { Router } from 'express';
import type { AuthService } from '../auth/auth.service';
import type { AppEnv } from '../../config/env';
import { requireAuth } from '../../common/auth/require-auth';
import { successResponse } from '../../common/http/response';
import type { NodeService } from './node.service';

export function createNodeRouter(
  authService: AuthService,
  nodeService: NodeService,
  env: AppEnv,
): Router {
  const router = Router();
  router.use(requireAuth(authService, env.SESSION_COOKIE_NAME));

  router.get('/', async (_request, response) => {
    const nodes = await nodeService.list();
    response.json(successResponse(nodes, response.locals.requestId as string));
  });

  return router;
}
