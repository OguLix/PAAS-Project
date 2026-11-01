import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import type {
  ApplicationResponse,
  CreateApplicationInput,
  UpdateApplicationInput,
} from '@ogulix/shared';
import { conflict, notFound } from '../../common/errors/http-error';
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
    status: application.status,
    currentDeploymentId: application.deployments[0]?.id ?? null,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
  };
}

function toResponse(record: ApplicationRecord): ApplicationResponse {
  const { ownerId: _ownerId, createdAt, updatedAt, ...application } = record;
  return {
    ...application,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
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

  async list(query: ApplicationListQuery): Promise<ApplicationResponse[]> {
    const applications = await this.prisma.application.findMany({
      where: { status: 'ACTIVE', ...(query.ownerId ? { ownerId: query.ownerId } : {}) },
      include: currentDeploymentSelection,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: query.skip,
      take: query.take,
    });
    return applications.map((application) => toResponse(toRecord(application)));
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
      const application = await this.prisma.application.update({
        where: { id: applicationId, status: 'ACTIVE' },
        data: { status: 'ARCHIVED' },
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
}
