import type {
  DeploymentErrorCode,
  DeploymentLogLevel,
  DeploymentLogStream,
  DeploymentStatus,
  NodeStatus,
} from '@ogulix/shared';

export const MAX_DEPLOYMENT_LOG_LINES = 2000;
export const MAX_DEPLOYMENT_LOG_BYTES = 200 * 1024;

export type WorkerApplicationSpec = {
  id: string;
  name: string;
  sourceRepository: string;
  defaultBranch: string;
  dockerfilePath: string;
  buildContext: string;
  internalPort: number;
  healthCheckPath: string;
  cpuCores: number;
  memoryMb: number;
  pidsLimit: number;
};

export type WorkerDeploymentContext = {
  id: string;
  applicationId: string;
  runtimeNodeId: string | null;
  status: DeploymentStatus;
  branch: string | null;
  commitSha: string | null;
  allocatedPort: number | null;
  application: WorkerApplicationSpec;
  activeHostnames: string[];
  encryptedEnvVars: Array<{ key: string; encryptedValue: string; isSecret: boolean }>;
};

export type SchedulableNode = {
  id: string;
  name: string;
  host: string;
  sshPort: number;
  status: NodeStatus;
  capacityCpuMillicores: number;
  capacityMemoryMb: number;
  allocatedCpuMillicores: number;
  allocatedMemoryMb: number;
  allocatedPorts: number[];
};

export type RunningDeploymentSummary = {
  id: string;
  runtimeNodeId: string | null;
  runtimeNodeHost: string | null;
  allocatedPort: number | null;
};

export type DeploymentTransitionPatch = {
  runtimeNodeId?: string | null;
  allocatedPort?: number | null;
  imageReference?: string | null;
  imageDigest?: string | null;
  errorCode?: DeploymentErrorCode | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
};

export type DeploymentLogWrite = {
  level: DeploymentLogLevel;
  stream: DeploymentLogStream;
  message: string;
};

export interface WorkerDeploymentRepository {
  findDeploymentContext(deploymentId: string): Promise<WorkerDeploymentContext | null>;
  findRuntimeNodeHost(nodeId: string): Promise<string | null>;
  listSchedulableNodes(): Promise<SchedulableNode[]>;
  findRunningDeployments(
    applicationId: string,
    excludeDeploymentId?: string,
  ): Promise<RunningDeploymentSummary[]>;
  transitionStatus(
    deploymentId: string,
    from: DeploymentStatus,
    to: DeploymentStatus,
    patch?: DeploymentTransitionPatch,
  ): Promise<boolean>;
  appendLog(
    deploymentId: string,
    entry: DeploymentLogWrite,
    extraSecrets?: readonly string[],
  ): Promise<boolean>;
}
