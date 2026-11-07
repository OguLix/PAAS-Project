import type { DeployJobPayload, RestartJobPayload, StopJobPayload } from "../queues/deployment.queue";

export const DEPLOY_JOB_NAME = "deploy";
export const STOP_JOB_NAME = "stop";
export const RESTART_JOB_NAME = "restart";

export function isDeployJob(payload: unknown): payload is DeployJobPayload {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }
  const p = payload as Record<string, unknown>;
  return (
    typeof p.deploymentId === "string" &&
    typeof p.applicationId === "string" &&
    typeof p.requestedByUserId === "string" &&
    !("action" in p) &&
    !("containerName" in p)
  );
}

export function isStopJob(payload: unknown): payload is StopJobPayload {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }
  const p = payload as Record<string, unknown>;
  return (
    typeof p.deploymentId === "string" &&
    typeof p.applicationId === "string" &&
    typeof p.requestedByUserId === "string"
  );
}

export function isRestartJob(payload: unknown): payload is RestartJobPayload {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }
  const p = payload as Record<string, unknown>;
  return (
    typeof p.deploymentId === "string" &&
    typeof p.applicationId === "string" &&
    typeof p.requestedByUserId === "string"
  );
}
