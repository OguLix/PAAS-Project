import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import type { DeploymentErrorCode, DeploymentStatus } from '@ogulix/shared';
import type {
  DeploymentLogQuery,
  DeploymentLogRecord,
  DeploymentRecord,
  DeploymentRepository,
  NewDeploymentRecord,
} from '../../modules/deployments/deployment.repository';

const deploymentSelect = {
  id: true,
  applicationId: true,
  runtimeNodeId: true,
  status: true,
  branch: true,
  commitSha: true,
  idempotencyKey: true,
  requestFingerprint: true,
  requestedByUserId: true,
  errorCode: true,
  createdAt: true,
  startedAt: true,
  finishedAt: true,
} satisfies Prisma.DeploymentSelect;

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export class PrismaDeploymentRepository implements DeploymentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listByApplication(
    applicationId: string,
    query: { skip: number; take: number },
  ): Promise<DeploymentRecord[]> {
    return this.prisma.deployment.findMany({
      where: { applicationId },
      select: deploymentSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: query.skip,
      take: query.take,
    });
  }

  countByApplication(applicationId: string): Promise<number> {
    return this.prisma.deployment.count({ where: { applicationId } });
  }

  findById(deploymentId: string): Promise<DeploymentRecord | null> {
    return this.prisma.deployment.findUnique({
      where: { id: deploymentId },
      select: deploymentSelect,
    });
  }

  findByIdempotencyKey(
    applicationId: string,
    idempotencyKey: string,
  ): Promise<DeploymentRecord | null> {
    return this.prisma.deployment.findUnique({
      where: {
        applicationId_idempotencyKey: {
          applicationId,
          idempotencyKey,
        },
      },
      select: deploymentSelect,
    });
  }

  async create(input: NewDeploymentRecord): Promise<DeploymentRecord> {
    try {
      return await this.prisma.deployment.create({
        data: {
          applicationId: input.applicationId,
          branch: input.branch,
          commitSha: input.commitSha,
          idempotencyKey: input.idempotencyKey,
          requestFingerprint: input.requestFingerprint,
          requestedByUserId: input.requestedByUserId,
          status: 'QUEUED',
        },
        select: deploymentSelect,
      });
    } catch (error) {
      if (input.idempotencyKey && isUniqueConstraintError(error)) {
        const existing = await this.findByIdempotencyKey(input.applicationId, input.idempotencyKey);
        if (existing) {
          return existing;
        }
      }
      throw error;
    }
  }

  async transitionStatus(
    deploymentId: string,
    from: DeploymentStatus,
    to: DeploymentStatus,
    extra: {
      errorCode?: DeploymentErrorCode | null;
      finishedAt?: Date | null;
      clearAllocatedPort?: boolean;
    } = {},
  ): Promise<DeploymentRecord | null> {
    const updated = await this.prisma.deployment.updateMany({
      where: { id: deploymentId, status: from },
      data: {
        status: to,
        ...(extra.errorCode !== undefined ? { errorCode: extra.errorCode } : {}),
        ...(extra.finishedAt !== undefined ? { finishedAt: extra.finishedAt } : {}),
        ...(extra.clearAllocatedPort ? { allocatedPort: null } : {}),
      },
    });
    if (updated.count === 0) {
      return null;
    }

    return this.findById(deploymentId);
  }

  listLogsByDeployment(
    deploymentId: string,
    query: DeploymentLogQuery,
  ): Promise<DeploymentLogRecord[]> {
    return this.prisma.deploymentLog.findMany({
      where: {
        deploymentId,
        ...(query.after !== undefined ? { sequence: { gt: query.after } } : {}),
      },
      select: {
        deploymentId: true,
        sequence: true,
        level: true,
        stream: true,
        message: true,
        createdAt: true,
      },
      orderBy: { sequence: 'asc' },
      take: query.limit,
    });
  }

  async listLogsByApplication(
    applicationId: string,
    query: DeploymentLogQuery,
  ): Promise<DeploymentLogRecord[]> {
    const latestDeployment = await this.prisma.deployment.findFirst({
      where: { applicationId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true },
    });
    if (!latestDeployment) {
      return [];
    }

    return this.listLogsByDeployment(latestDeployment.id, query);
  }
}
