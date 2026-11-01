import type { ApiErrorCode, ApiErrorResponse, ApiSuccessResponse } from '@ogulix/shared';

/**
 * Single API client for the dashboard. Requests rely on the opaque session
 * cookie, so there is no token handling here and nothing to store in the
 * browser. Only client components should call this module directly; server
 * components need an absolute base URL.
 */
const DEFAULT_BASE_URL = '/api/v1';

export class ApiClientError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly requestId: string;

  constructor(message: string, code: ApiErrorCode, status: number, requestId: string) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

export function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_BASE_URL;
}

export async function apiRequest<TData>(
  path: string,
  init: RequestInit = {},
): Promise<ApiSuccessResponse<TData>> {
  const headers = new Headers(init.headers);

  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  });

  const payload = (await response.json().catch(() => null)) as
    ApiSuccessResponse<TData> | ApiErrorResponse | null;

  if (payload === null) {
    throw new ApiClientError(
      'The API returned a non-JSON response.',
      'INTERNAL_ERROR',
      response.status,
      'unknown',
    );
  }

  if (!response.ok || 'error' in payload) {
    const error = 'error' in payload ? payload.error : undefined;

    throw new ApiClientError(
      error?.message ?? 'The API request failed.',
      error?.code ?? 'INTERNAL_ERROR',
      response.status,
      payload.meta.requestId,
    );
  }

  return payload;
}
