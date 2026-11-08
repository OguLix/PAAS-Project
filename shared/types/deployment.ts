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
