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
  'INVALID_STATE',
  'IDEMPOTENCY_CONFLICT',
  'UNPROCESSABLE',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'SERVICE_UNAVAILABLE',
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

/** Whether runtime operations are simulated or target the IAAS nodes. */
export type RuntimeMode = 'mock' | 'iaas';

export type HealthResponse = {
  status: HealthStatus;
  service: string;
  uptimeSeconds: number;
  runtimeMode: RuntimeMode;
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

export type UserRole = 'USER' | 'ADMIN';

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
};

export type ApplicationStatus = 'ACTIVE' | 'ARCHIVED';

export type ApplicationDeploymentConfig = {
  dockerfilePath: string;
  buildContext: string;
  internalPort: number;
  healthCheckPath: string;
  cpuCores: number;
  memoryMb: number;
  pidsLimit: number;
};

export type ApplicationResponse = ApplicationDeploymentConfig & {
  id: string;
  name: string;
  sourceRepository: string;
  defaultBranch: string;
  status: ApplicationStatus;
  currentDeploymentId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DomainStatus = 'PENDING' | 'ACTIVE' | 'FAILED' | 'DISABLED';

export type DomainResponse = {
  id: string;
  applicationId: string;
  hostname: string;
  isPrimary: boolean;
  status: DomainStatus;
  createdAt: string;
};
