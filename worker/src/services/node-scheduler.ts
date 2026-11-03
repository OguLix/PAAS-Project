export class NodeScheduler {
  selectNode(_constraints: unknown): { nodeId: string } {
    throw new Error('Node scheduler not implemented in scaffold');
  }
}
