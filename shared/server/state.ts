import { DEPLOYMENT_TRANSITIONS, type DeploymentStatus } from '../types/deployment-status';

export class InvalidDeploymentTransitionError extends Error {
  constructor(
    readonly from: DeploymentStatus,
    readonly to: DeploymentStatus,
  ) {
    super(`Invalid deployment transition: ${from} -> ${to}`);
    this.name = 'InvalidDeploymentTransitionError';
  }
}

/** Throw before a worker or API writes a status that the state machine forbids. */
export function assertDeploymentTransition(from: DeploymentStatus, to: DeploymentStatus): void {
  if (!DEPLOYMENT_TRANSITIONS[from].includes(to)) {
    throw new InvalidDeploymentTransitionError(from, to);
  }
}

export function allowedDeploymentTransitions(from: DeploymentStatus): readonly DeploymentStatus[] {
  return DEPLOYMENT_TRANSITIONS[from];
}
