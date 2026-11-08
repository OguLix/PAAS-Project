import type { ApiErrorCode, ApiErrorDetail } from '@ogulix/shared';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: ApiErrorDetail[],
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function notFound(message = 'Resource not found'): HttpError {
  return new HttpError(404, 'NOT_FOUND', message);
}

export function conflict(message: string): HttpError {
  return new HttpError(409, 'CONFLICT', message);
}

export function invalidState(message = 'Operation is not allowed in the current state'): HttpError {
  return new HttpError(409, 'INVALID_STATE', message);
}

export function idempotencyConflict(
  message = 'Idempotency key was reused with a different request',
): HttpError {
  return new HttpError(409, 'IDEMPOTENCY_CONFLICT', message);
}

export function serviceUnavailable(message = 'Service is temporarily unavailable'): HttpError {
  return new HttpError(503, 'SERVICE_UNAVAILABLE', message);
}
