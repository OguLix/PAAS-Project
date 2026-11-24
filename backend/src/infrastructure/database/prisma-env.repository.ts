import type { PrismaClient } from '@prisma/client';
import type {
  EnvironmentVariableRecord,
  EnvironmentVariableRepository,
} from '../../modules/env/env.repository';

const summarySelect = {
  id: true,
  applicationId: true,
  key: true,
  isSecret: true,
  createdAt: true,
  updatedAt: true,
};

export class PrismaEnvironmentVariableRepository implements EnvironmentVariableRepository {
  constructor(private readonly prisma: PrismaClient) {}

  listByApplication(applicationId: string): Promise<EnvironmentVariableRecord[]> {
    return this.prisma.environmentVariable.findMany({
      where: { applicationId },
      select: summarySelect,
      orderBy: { key: 'asc' },
    });
  }

  upsert(
    applicationId: string,
    key: string,
    encryptedValue: string,
    isSecret: boolean,
  ): Promise<EnvironmentVariableRecord> {
    return this.prisma.environmentVariable.upsert({
      where: {
        applicationId_key: {
          applicationId,
          key,
        },
      },
      update: { encryptedValue, isSecret },
      create: { applicationId, key, encryptedValue, isSecret },
      select: summarySelect,
    });
  }

  async deleteByKey(applicationId: string, key: string): Promise<boolean> {
    const deleted = await this.prisma.environmentVariable.deleteMany({
      where: { applicationId, key },
    });
    return deleted.count > 0;
  }
}
