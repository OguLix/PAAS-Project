import type { NodeRequestEnvelope, NodeResponseEnvelope } from '@ogulix/shared';

export class SshAdapter {
  constructor(
    private readonly host: string,
    private readonly port: number = 22,
    private readonly username: string = 'ogulix-node',
    private readonly privateKeyPath?: string,
  ) {}

  async send(command: NodeRequestEnvelope): Promise<NodeResponseEnvelope> {
    // Scaffold: actual SSH/forced command implementation is deferred until runtime wiring.
    // The adapter boundary exists to enforce the allowlist and to be mocked in tests.
    throw new Error(`SSH adapter not implemented in scaffold for command ${command.command}`);
  }

  getTarget(): string {
    return `${this.username}@${this.host}:${this.port}`;
  }
}
