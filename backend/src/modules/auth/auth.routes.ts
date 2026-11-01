import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import {
  loginInputSchema,
  registerInputSchema,
  type AuthUser,
  type ApiErrorResponse,
} from '@ogulix/shared';
import type { AppEnv } from '../../config/env';
import { readCookie, setSessionCookie, clearSessionCookie } from '../../common/auth/cookie';
import { getAuthContext } from '../../common/auth/get-auth-context';
import { requireAuth } from '../../common/auth/require-auth';
import { errorResponse, successResponse } from '../../common/http/response';
import { parseInput } from '../../common/validation/parse-input';
import type { AuthService } from './auth.service';

function authRateLimit(maximum: number) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: maximum,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (request, response) => {
      response
        .status(429)
        .json(
          errorResponse(
            'RATE_LIMITED',
            'Too many authentication attempts',
            response.locals.requestId as string,
          ) satisfies ApiErrorResponse,
        );
    },
  });
}

function setAuthCookie(
  response: Parameters<typeof setSessionCookie>[0],
  env: AppEnv,
  token: string,
  expiresAt: Date,
): void {
  const maxAgeSeconds = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  setSessionCookie(response, env.SESSION_COOKIE_NAME, token, maxAgeSeconds);
}

export function createAuthRouter(authService: AuthService, env: AppEnv): Router {
  const router = Router();

  router.post('/register', authRateLimit(5), async (request, response) => {
    const input = parseInput(registerInputSchema, request.body);
    const session = await authService.register(input, response.locals.requestId as string);
    setAuthCookie(response, env, session.token, session.expiresAt);
    response
      .status(201)
      .json(successResponse({ user: session.user }, response.locals.requestId as string));
  });

  router.post('/login', authRateLimit(10), async (request, response) => {
    const input = parseInput(loginInputSchema, request.body);
    const session = await authService.login(input, response.locals.requestId as string);
    setAuthCookie(response, env, session.token, session.expiresAt);
    response
      .status(200)
      .json(successResponse({ user: session.user }, response.locals.requestId as string));
  });

  router.post('/logout', async (request, response) => {
    const token = readCookie(request.headers.cookie, env.SESSION_COOKIE_NAME);
    await authService.logout(token, response.locals.requestId as string);
    clearSessionCookie(response, env.SESSION_COOKIE_NAME);
    response
      .status(200)
      .json(successResponse({ loggedOut: true }, response.locals.requestId as string));
  });

  router.get('/me', requireAuth(authService, env.SESSION_COOKIE_NAME), (request, response) => {
    const auth = getAuthContext(request);
    const user: AuthUser = {
      id: auth.userId,
      email: auth.email,
      role: auth.role,
    };
    response.json(successResponse({ user }, response.locals.requestId as string));
  });

  return router;
}
