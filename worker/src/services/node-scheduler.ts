import type { SchedulableNode } from '../repositories/deployment.repository';

export const MIN_ALLOCATED_PORT = 30000;
export const MAX_ALLOCATED_PORT = 32767;
/** Reserve OS + Docker headroom on constrained 2 GiB VMs. */
const RESERVED_HOST_MEMORY_MB = 512;

export type NodeScheduleRequest = {
  cpuCores: number;
  memoryMb: number;
};

export type NodeAllocation = {
  node: SchedulableNode;
  allocatedPort: number;
};

function findAvailablePort(usedPorts: ReadonlySet<number>): number | null {
  for (let port = MIN_ALLOCATED_PORT; port <= MAX_ALLOCATED_PORT; port += 1) {
    if (!usedPorts.has(port)) {
      return port;
    }
  }
  return null;
}

export class NodeScheduler {
  selectNode(
    nodes: readonly SchedulableNode[],
    request: NodeScheduleRequest,
  ): NodeAllocation | null {
    const requestedCpuMillicores = Math.round(request.cpuCores * 1000);
    const candidates = nodes
      .filter((node) => node.status === 'ONLINE')
      .map((node) => {
        const usableMemoryMb = Math.max(0, node.capacityMemoryMb - RESERVED_HOST_MEMORY_MB);
        const freeMemoryMb = usableMemoryMb - node.allocatedMemoryMb;
        const freeCpuMillicores = node.capacityCpuMillicores - node.allocatedCpuMillicores;
        const allocatedPort = findAvailablePort(new Set(node.allocatedPorts));
        return { node, freeMemoryMb, freeCpuMillicores, allocatedPort };
      })
      .filter(
        (candidate) =>
          candidate.allocatedPort !== null &&
          candidate.freeMemoryMb >= request.memoryMb &&
          candidate.freeCpuMillicores >= requestedCpuMillicores,
      )
      .sort((left, right) => {
        if (right.freeMemoryMb !== left.freeMemoryMb) {
          return right.freeMemoryMb - left.freeMemoryMb;
        }
        return right.freeCpuMillicores - left.freeCpuMillicores;
      });

    const chosen = candidates[0];
    if (!chosen || chosen.allocatedPort === null) {
      return null;
    }

    return { node: chosen.node, allocatedPort: chosen.allocatedPort };
  }
}
