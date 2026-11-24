import type { PrismaClient } from '@prisma/client';
import type { NodeRepository, RuntimeNodeRecord } from '../../modules/nodes/node.repository';

export class PrismaNodeRepository implements NodeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  list(): Promise<RuntimeNodeRecord[]> {
    return this.prisma.runtimeNode.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        capacityCpuMillicores: true,
        capacityMemoryMb: true,
        lastHeartbeatAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
    });
  }
}
