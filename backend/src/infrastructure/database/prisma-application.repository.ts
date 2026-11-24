import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import {
  ACTIVE_DEPLOYMENT_STATUSES,
  type CreateApplicationInput,
  type UpdateApplicationInput,
} from '@ogulix/shared';
import { conflict, invalidState, notFound } from '../../common/errors/http-error';
import type {
  ApplicationListQuery,
  ApplicationRecord,
  ApplicationRepository,
} from '../../modules/applications/application.repository';

const currentDeploymentSelection = {
  deployments: {
    where: { status: 'RUNNING' as const },
    orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
    take: 1,
    select: { id: true },
  },
};

function toRecord(
  application: Prisma.ApplicationGetPayload<{ include: typeof currentDeploymentSelection }>,
): ApplicationRecord {
  return {
    id: application.id,
    ownerId: application.ownerId,
    name: application.name,
    sourceRepository: application.sourceRepository,
    defaultBranch: application.defaultBranch,
    dockerfilePath: application.dockerfilePath,
    buildContext: application.buildContext,
    internalPort: application.internalPort,
    healthCheckPath: application.healthCheckPath,
    cpuCores: application.cpuCores,
    memoryMb: application.memoryMb,
    pidsLimit: application.pidsLimit,
    status: application.status,
    currentDeploymentId: application.deployments[0]?.id ?? null,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function isRecordNotFoundError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

export class PrismaApplicationRepository implements ApplicationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(query: ApplicationListQuery): Promise<ApplicationRecord[]> {
    const applications = await this.prisma.application.findMany({
      where: { status: 'ACTIVE', ...(query.ownerId ? { ownerId: query.ownerId } : {}) },
      include: currentDeploymentSelection,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: query.skip,
      take: query.take,
    });
    return applications.map(toRecord);
  }

  count(ownerId?: string): Promise<number> {
    return this.prisma.application.count({
      where: { status: 'ACTIVE', ...(ownerId ? { ownerId } : {}) },
    });
  }

  async findActiveById(applicationId: string): Promise<ApplicationRecord | null> {
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, status: 'ACTIVE' },
      include: currentDeploymentSelection,
    });
    return application ? toRecord(application) : null;
  }

  async hasActiveDeployments(applicationId: string): Promise<boolean> {
    const count = await this.prisma.deployment.count({
      where: {
        applicationId,
        status: { in: [...ACTIVE_DEPLOYMENT_STATUSES] },
      },
    });
    return count > 0;
  }

  async create(ownerId: string, input: CreateApplicationInput): Promise<ApplicationRecord> {
    try {
      const application = await this.prisma.application.create({
        data: { ownerId, ...input },
        include: currentDeploymentSelection,
      });
      return toRecord(application);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw conflict('Application could not be created because of a uniqueness conflict');
      }
      throw error;
    }
  }

  async update(applicationId: string, input: UpdateApplicationInput): Promise<ApplicationRecord> {
    try {
      const application = await this.prisma.application.update({
        where: { id: applicationId, status: 'ACTIVE' },
        data: input,
        include: currentDeploymentSelection,
      });
      return toRecord(application);
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        throw notFound('Application not found');
      }
      throw error;
    }
  }

  async archive(applicationId: string): Promise<ApplicationRecord> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const activeCount = await transaction.deployment.count({
          where: {
            applicationId,
            status: { in: [...ACTIVE_DEPLOYMENT_STATUSES] },
          },
        });
        if (activeCount > 0) {
          throw invalidState(
            'Cannot archive an application with an active deployment; stop or cancel it first',
          );
        }

        const application = await transaction.application.update({
          where: { id: applicationId, status: 'ACTIVE' },
          data: { status: 'ARCHIVED' },
          include: currentDeploymentSelection,
        });
        return toRecord(application);
      });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        throw notFound('Application not found');
      }
      throw error;
    }
  }
}
