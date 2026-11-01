/**
 * API envelope types shared by the Express API, the Next.js dashboard and tests.
 * Shapes mirror docs/design/api-contract.md.
 */

export type Pagination = {
  page: number;
  pageSize: number;
  total: number;
};

export type ApiMeta = {
  requestId: string;
  pagination?: Pagination;
};

export type ApiSuccessResponse<TData> = {
  data: TData;
  meta: ApiMeta;
};

export type ApiListResponse<TItem> = {
  data: TItem[];
  meta: ApiMeta & { pagination: Pagination };
};

export const API_ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'REGISTRATION_CLOSED',
  'NOT_FOUND',
  'CONFLICT',
  'UNPROCESSABLE',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export type ApiErrorDetail = {
  field?: string;
  code: string;
  message: string;
};

export type ApiErrorResponse = {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: ApiErrorDetail[];
  };
  meta: ApiMeta;
};

export type HealthStatus = 'ok' | 'degraded' | 'unavailable';

export type HealthResponse = {
  status: HealthStatus;
  service: string;
  uptimeSeconds: number;
};

export type ReadinessCheck = {
  name: 'database' | 'queue' | 'traefik';
  ready: boolean;
  detail?: string;
};

export type ReadinessResponse = {
  ready: boolean;
  checks: ReadinessCheck[];
};
