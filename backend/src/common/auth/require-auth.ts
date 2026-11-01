import type { RequestHandler } from 'express';
import type { AuthService } from '../../modules/auth/auth.service';
import { HttpError } from '../errors/http-error';
import { readCookie } from './cookie';

export function requireAuth(authService: AuthService, cookieName: string): RequestHandler {
  return async (request, _response, next) => {
    try {
      const token = readCookie(request.headers.cookie, cookieName);
      if (!token) {
        throw new HttpError(401, 'UNAUTHENTICATED', 'Authentication required');
      }

      request.auth = await authService.authenticate(token);
      next();
    } catch (error) {
      next(error);
    }
  };
}
