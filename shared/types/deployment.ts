import type { DeploymentStatus } from './deployment-status';

/** Stable deployment failure codes. Do not expose provider-specific text here. */
export const DEPLOYMENT_ERROR_CODES = [
  'BUILD_FAILED',
  'BUILD_TIMEOUT',
  'NODE_UNAVAILABLE',
  'CONTAINER_START_FAILED',
  'HEALTH_CHECK_FAILED',
  'ROUTE_FAILED',
  'CANCELLED_BY_USER',
  'INTERNAL_ERROR',
] as const;

export type DeploymentErrorCode = (typeof DEPLOYMENT_ERROR_CODES)[number];

/** Sanitized, user-facing diagnostics mapped from stable deployment error codes. */
export const DEPLOYMENT_ERROR_MESSAGES: Record<DeploymentErrorCode, string> = {
  BUILD_FAILED: 'Container image build failed. Check the build logs for details.',
  BUILD_TIMEOUT: 'Container image build exceeded the allowed time limit.',
  NODE_UNAVAILABLE: 'No healthy runtime node with enough capacity is currently available.',
  CONTAINER_START_FAILED: 'The application container could not be started on the runtime node.',
  HEALTH_CHECK_FAILED: 'The application did not pass its HTTP health check in time.',
  ROUTE_FAILED: 'The reverse proxy route could not be updated for this deployment.',
  CANCELLED_BY_USER: 'Deployment was cancelled before execution began.',
  INTERNAL_ERROR: 'An internal control-plane error interrupted this deployment.',
};

export function getDeploymentErrorMessage(code: string | null | undefined): string | null {
  if (!code || !isDeploymentErrorCode(code)) {
    return null;
  }
  return DEPLOYMENT_ERROR_MESSAGES[code];
}

export type DeploymentResponse = {
  id: string;
  applicationId: string;
  runtimeNodeId: string | null;
  status: DeploymentStatus;
  branch: string | null;
  commitSha: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  errorCode: DeploymentErrorCode | null;
  /** Sanitized diagnostic. Never contains raw provider output or secrets. */
  errorMessage: string | null;
};

export type DeploymentLogLevel = 'INFO' | 'WARN' | 'ERROR';

export type DeploymentLogStream = 'BUILD' | 'SYSTEM';

export type DeploymentLogEntry = {
  deploymentId: string;
  sequence: number;
  level: DeploymentLogLevel;
  stream: DeploymentLogStream;
  message: string;
  createdAt: string;
};

export function isDeploymentErrorCode(value: string): value is DeploymentErrorCode {
  return (DEPLOYMENT_ERROR_CODES as readonly string[]).includes(value);
}
