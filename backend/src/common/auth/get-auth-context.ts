import type { Request } from 'express';
import type { AuthContext } from './auth-context';
import { HttpError } from '../errors/http-error';

export function getAuthContext(request: Request): AuthContext {
  if (!request.auth) {
    throw new HttpError(401, 'UNAUTHENTICATED', 'Authentication required');
  }

  return request.auth;
}
