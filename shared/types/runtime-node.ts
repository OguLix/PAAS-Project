export const NODE_STATUSES = ['ONLINE', 'DEGRADED', 'OFFLINE', 'MAINTENANCE'] as const;

export type NodeStatus = (typeof NODE_STATUSES)[number];

/**
 * Public runtime-node inventory. Host, SSH port and credentials are
 * deliberately absent: they are private control-plane details.
 */
export type RuntimeNodeResponse = {
  id: string;
  name: string;
  status: NodeStatus;
  capacityCpuMillicores: number;
  capacityMemoryMb: number;
  lastHeartbeatAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function isNodeStatus(value: string): value is NodeStatus {
  return (NODE_STATUSES as readonly string[]).includes(value);
}
