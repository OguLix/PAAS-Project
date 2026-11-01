/**
 * Restricted runtime-node protocol.
 *
 * The worker's SSH key is pinned to a forced command on each node:
 *   command="/usr/local/bin/ogulix-node",no-pty,no-port-forwarding,...
 * The helper accepts only the commands below plus a JSON payload on stdin.
 * See docs/operations/ssh-configuration.md and docs/design/decisions.md.
 */

export const NODE_COMMANDS = [
  'node-info',
  'build',
  'container-upsert',
  'container-start',
  'container-stop',
  'container-inspect',
  'container-remove',
  'logs',
  'cleanup',
] as const;

export type NodeCommand = (typeof NODE_COMMANDS)[number];

export type NodeRequestEnvelope<TPayload = unknown> = {
  requestId: string;
  command: NodeCommand;
  payload: TPayload;
};

export type NodeErrorCode =
  | 'UNKNOWN_COMMAND'
  | 'INVALID_PAYLOAD'
  | 'BUILD_FAILED'
  | 'BUILD_TIMEOUT'
  | 'CONTAINER_FAILED'
  | 'IMAGE_NOT_FOUND'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR';

export type NodeSuccessEnvelope<TData> = {
  ok: true;
  data: TData;
};

export type NodeFailureEnvelope = {
  ok: false;
  error: {
    code: NodeErrorCode;
    message: string;
  };
};

export type NodeResponseEnvelope<TData = unknown> =
  NodeSuccessEnvelope<TData> | NodeFailureEnvelope;

export type NodeInfo = {
  hostname: string;
  cpuCores: number;
  memoryTotalMb: number;
  memoryAvailableMb: number;
  diskAvailableMb: number;
  dockerVersion: string | null;
};

export type BuildRequest = {
  deploymentId: string;
  sourceRepository: string;
  commitSha: string | null;
  branch: string;
  dockerfilePath: string;
  imageReference: string;
  timeoutSeconds: number;
};

export type BuildResult = {
  imageReference: string;
  imageDigest: string;
  durationSeconds: number;
};

export type ContainerSpec = {
  name: string;
  imageReference: string;
  internalPort: number;
  hostPort: number;
  cpuCores: number;
  memoryMb: number;
  pidsLimit: number;
  restartPolicy: 'unless-stopped';
  env: Record<string, string>;
  labels: Record<string, string>;
};

export type ContainerState = {
  id: string;
  name: string;
  status: 'created' | 'running' | 'exited' | 'unknown';
  health: 'healthy' | 'unhealthy' | 'none';
};

export type LogsRequest = {
  containerName: string;
  tailLines: number;
  sinceSeconds: number;
};

export type LogsResult = {
  lines: string[];
  truncated: boolean;
};

export function isNodeCommand(value: string): value is NodeCommand {
  return (NODE_COMMANDS as readonly string[]).includes(value);
}
