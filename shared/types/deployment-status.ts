/**
 * Canonical deployment lifecycle.
 *
 * Source of truth: docs/architecture/deployment-state-machine.md.
 * These values are the only allowed statuses. Do not add frontend-only states,
 * and do not reintroduce the withdrawn DEPLOYING or SUCCEEDED labels.
 */

export const DEPLOYMENT_STATUSES = [
  'QUEUED',
  'PREPARING',
  'BUILDING',
  'STARTING',
  'HEALTH_CHECKING',
  'RUNNING',
  'STOPPING',
  'STOPPED',
  'FAILED',
  'CANCELLED',
] as const;

export type DeploymentStatus = (typeof DEPLOYMENT_STATUSES)[number];

/** Terminal for an individual deployment attempt. A redeploy is a new attempt. */
export const TERMINAL_DEPLOYMENT_STATUSES = [
  'RUNNING',
  'STOPPED',
  'FAILED',
  'CANCELLED',
] as const satisfies readonly DeploymentStatus[];

export type TerminalDeploymentStatus = (typeof TERMINAL_DEPLOYMENT_STATUSES)[number];

export const DEPLOYMENT_STATUS_LABELS: Record<DeploymentStatus, string> = {
  QUEUED: 'Queued',
  PREPARING: 'Preparing',
  BUILDING: 'Building',
  STARTING: 'Starting',
  HEALTH_CHECKING: 'Checking health',
  RUNNING: 'Running',
  STOPPING: 'Stopping',
  STOPPED: 'Stopped',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
};

/**
 * Allowed transitions from the documented state diagram.
 * RESTART and REDEPLOY are modelled as an explicit operation or a new
 * deployment attempt, so they do not add extra rows here.
 */
export const DEPLOYMENT_TRANSITIONS: Record<DeploymentStatus, readonly DeploymentStatus[]> = {
  QUEUED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['BUILDING', 'FAILED'],
  BUILDING: ['STARTING', 'FAILED'],
  STARTING: ['HEALTH_CHECKING', 'FAILED'],
  HEALTH_CHECKING: ['RUNNING', 'FAILED'],
  RUNNING: ['STOPPING'],
  STOPPING: ['STOPPED', 'FAILED'],
  STOPPED: [],
  FAILED: [],
  CANCELLED: [],
};

export function isDeploymentStatus(value: string): value is DeploymentStatus {
  return (DEPLOYMENT_STATUSES as readonly string[]).includes(value);
}

export function isTerminalDeploymentStatus(status: DeploymentStatus): boolean {
  return (TERMINAL_DEPLOYMENT_STATUSES as readonly DeploymentStatus[]).includes(status);
}

export function canTransition(from: DeploymentStatus, to: DeploymentStatus): boolean {
  return DEPLOYMENT_TRANSITIONS[from].includes(to);
}
