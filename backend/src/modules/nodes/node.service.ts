import type { RuntimeNodeResponse } from '@ogulix/shared';
import type { NodeRepository } from './node.repository';

export class NodeService {
  constructor(private readonly repository: NodeRepository) {}

  async list(): Promise<RuntimeNodeResponse[]> {
    const nodes = await this.repository.list();
    return nodes.map((node) => ({
      id: node.id,
      name: node.name,
      status: node.status,
      capacityCpuMillicores: node.capacityCpuMillicores,
      capacityMemoryMb: node.capacityMemoryMb,
      lastHeartbeatAt: node.lastHeartbeatAt ? node.lastHeartbeatAt.toISOString() : null,
      createdAt: node.createdAt.toISOString(),
      updatedAt: node.updatedAt.toISOString(),
    }));
  }
}
