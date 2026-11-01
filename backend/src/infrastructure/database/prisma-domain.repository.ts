import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import type { CreateDomainInput } from '@ogulix/shared';
import { conflict, notFound } from '../../common/errors/http-error';
import type { DomainRecord, DomainRepository } from '../../modules/domains/domain.repository';

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function toRecord(domain: {
  id: string;
  applicationId: string;
  hostname: string;
  isPrimary: boolean;
  status: DomainRecord['status'];
  createdAt: Date;
}): DomainRecord {
  return {
    id: domain.id,
    applicationId: domain.applicationId,
    hostname: domain.hostname,
    isPrimary: domain.isPrimary,
    status: domain.status,
    createdAt: domain.createdAt,
  };
}

export class PrismaDomainRepository implements DomainRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(applicationId: string): Promise<DomainRecord[]> {
    const domains = await this.prisma.domain.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'asc' },
    });
    return domains.map(toRecord);
  }

  async create(applicationId: string, input: CreateDomainInput): Promise<DomainRecord> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const existingPrimary = await transaction.domain.findFirst({
          where: {
            applicationId,
            status: { not: 'DISABLED' },
            isPrimary: true,
          },
          select: { id: true },
        });
        const domain = await transaction.domain.create({
          data: {
            applicationId,
            hostname: input.hostname,
            isPrimary: existingPrimary === null,
          },
        });
        return toRecord(domain);
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw conflict('This hostname is already associated with an application');
      }
      throw error;
    }
  }

  async findById(domainId: string): Promise<DomainRecord | null> {
    const domain = await this.prisma.domain.findUnique({
      where: { id: domainId },
    });
    return domain ? toRecord(domain) : null;
  }

  async disable(domainId: string): Promise<DomainRecord> {
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.domain.findUnique({ where: { id: domainId } });
      if (!current) {
        throw notFound('Domain not found');
      }
      if (current.status === 'DISABLED') {
        return toRecord(current);
      }

      const disabled = await transaction.domain.update({
        where: { id: domainId },
        data: { status: 'DISABLED', isPrimary: false },
      });

      if (current.isPrimary) {
        const replacement = await transaction.domain.findFirst({
          where: {
            applicationId: current.applicationId,
            status: { not: 'DISABLED' },
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        });
        if (replacement) {
          await transaction.domain.update({
            where: { id: replacement.id },
            data: { isPrimary: true },
          });
        }
      }

      return toRecord(disabled);
    });
  }
}
