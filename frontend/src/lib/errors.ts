import type { ApiErrorCode } from '@ogulix/shared';
import { ApiClientError } from '@/lib/api-client';

/**
 * One user-facing sentence per documented error code.
 * See docs/design/api-contract.md section 2 and 5.
 */
const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  VALIDATION_ERROR: 'Check the highlighted fields and try again.',
  UNAUTHENTICATED: 'Your session has ended. Sign in again.',
  FORBIDDEN: 'You do not have access to this action.',
  REGISTRATION_CLOSED: 'Registration is closed for this workspace.',
  NOT_FOUND: 'That item no longer exists.',
  CONFLICT: 'That conflicts with an existing item.',
  UNPROCESSABLE: 'The request could not be processed.',
  RATE_LIMITED: 'Too many attempts. Wait a moment and try again.',
  INTERNAL_ERROR: 'The server could not complete the request.',
};

const NETWORK_MESSAGE = 'Cannot reach the API. Check your connection and try again.';
const UNKNOWN_MESSAGE = 'Something went wrong. Try again.';

export function messageForError(error: unknown): string {
  if (error instanceof ApiClientError) {
    return ERROR_MESSAGES[error.code] ?? UNKNOWN_MESSAGE;
  }

  if (error instanceof TypeError) {
    return NETWORK_MESSAGE;
  }

  return UNKNOWN_MESSAGE;
}

/**
 * A 401 during the login request means the credentials were rejected, not that
 * an existing session expired, so it gets its own sentence.
 */
export function signInErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError && error.code === 'UNAUTHENTICATED') {
    return 'Email or password is incorrect.';
  }

  return messageForError(error);
}

/**
 * Only same-origin relative paths are accepted as a post-login destination,
 * so a crafted ?next= cannot redirect the browser off this application.
 */
export function safeNextPath(value: string | undefined): string {
  if (!value) {
    return '/dashboard';
  }

  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return '/dashboard';
  }

  return value;
}
