import type {
  DeploymentErrorCode,
  DeploymentLogLevel,
  DeploymentLogStream,
  DeploymentStatus,
} from '@ogulix/shared';

export type DeploymentRecord = {
  id: string;
  applicationId: string;
  runtimeNodeId: string | null;
  status: DeploymentStatus;
  branch: string | null;
  commitSha: string | null;
  idempotencyKey: string | null;
  requestFingerprint: string | null;
  requestedByUserId: string | null;
  errorCode: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
};

export type NewDeploymentRecord = {
  applicationId: string;
  branch: string;
  commitSha: string | null;
  idempotencyKey: string | null;
  requestFingerprint: string | null;
  requestedByUserId: string;
};

export type DeploymentLogRecord = {
  deploymentId: string;
  sequence: number;
  level: DeploymentLogLevel;
  stream: DeploymentLogStream;
  message: string;
  createdAt: Date;
};

export type DeploymentLogQuery = {
  after?: number;
  limit: number;
};

export interface DeploymentRepository {
  listByApplication(
    applicationId: string,
    query: { skip: number; take: number },
  ): Promise<DeploymentRecord[]>;
  countByApplication(applicationId: string): Promise<number>;
  findById(deploymentId: string): Promise<DeploymentRecord | null>;
  findByIdempotencyKey(
    applicationId: string,
    idempotencyKey: string,
  ): Promise<DeploymentRecord | null>;
  create(input: NewDeploymentRecord): Promise<DeploymentRecord>;
  transitionStatus(
    deploymentId: string,
    from: DeploymentStatus,
    to: DeploymentStatus,
    extra?: {
      errorCode?: DeploymentErrorCode | null;
      finishedAt?: Date | null;
      clearAllocatedPort?: boolean;
    },
  ): Promise<DeploymentRecord | null>;
  listLogsByDeployment(
    deploymentId: string,
    query: DeploymentLogQuery,
  ): Promise<DeploymentLogRecord[]>;
  listLogsByApplication(
    applicationId: string,
    query: DeploymentLogQuery,
  ): Promise<DeploymentLogRecord[]>;
}
