import type { DeploymentStatus } from '@ogulix/shared';

export type DeploymentResponse = {
  id: string;
  applicationId: string;
  runtimeNodeId: string | null;
  status: DeploymentStatus;
  commitSha: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  errorCode: string | null;
};

export type DeploymentLogEntry = {
  sequence: number;
  level: 'INFO' | 'WARN' | 'ERROR';
  stream: 'BUILD' | 'SYSTEM';
  message: string;
  createdAt: string;
};
