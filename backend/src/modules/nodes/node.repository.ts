import type { NodeStatus } from '@ogulix/shared';

/** Public runtime node record; private host/SSH details are intentionally excluded. */
export type RuntimeNodeRecord = {
  id: string;
  name: string;
  status: NodeStatus;
  capacityCpuMillicores: number;
  capacityMemoryMb: number;
  lastHeartbeatAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface NodeRepository {
  list(): Promise<RuntimeNodeRecord[]>;
}
