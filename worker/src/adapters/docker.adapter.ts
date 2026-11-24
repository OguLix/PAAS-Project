import type { ContainerSpec, ContainerState } from '@ogulix/shared';
import type { NodeTransport } from './ssh.adapter';

export class DockerAdapter {
  constructor(private readonly transport: NodeTransport) {}

  async upsertContainer(targetHost: string, requestId: string, spec: ContainerSpec): Promise<void> {
    const response = await this.transport.send(targetHost, {
      requestId,
      command: 'container-upsert',
      payload: spec,
    });
    if (!response.ok) {
      throw new Error(response.error.code);
    }
  }

  async startContainer(targetHost: string, requestId: string, name: string): Promise<void> {
    const response = await this.transport.send(targetHost, {
      requestId,
      command: 'container-start',
      payload: { name },
    });
    if (!response.ok) {
      throw new Error(response.error.code);
    }
  }

  async stopContainer(targetHost: string, requestId: string, name: string): Promise<void> {
    const response = await this.transport.send(targetHost, {
      requestId,
      command: 'container-stop',
      payload: { name },
    });
    if (!response.ok) {
      throw new Error(response.error.code);
    }
  }

  async removeContainer(targetHost: string, requestId: string, name: string): Promise<void> {
    const response = await this.transport.send(targetHost, {
      requestId,
      command: 'container-remove',
      payload: { name },
    });
    if (!response.ok) {
      throw new Error(response.error.code);
    }
  }

  async inspectContainer(
    targetHost: string,
    requestId: string,
    name: string,
  ): Promise<ContainerState> {
    const response = await this.transport.send<ContainerState>(targetHost, {
      requestId,
      command: 'container-inspect',
      payload: { name },
    });
    if (!response.ok) {
      throw new Error(response.error.code);
    }
    return response.data;
  }
}
