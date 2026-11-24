import type { BuildRequest, BuildResult } from '@ogulix/shared';
import type { NodeTransport } from './ssh.adapter';

export class BuildkitAdapter {
  constructor(private readonly transport: NodeTransport) {}

  async build(targetHost: string, requestId: string, params: BuildRequest): Promise<BuildResult> {
    const response = await this.transport.send<BuildResult>(targetHost, {
      requestId,
      command: 'build',
      payload: params,
    });

    if (!response.ok) {
      throw new Error(response.error.code);
    }

    return response.data;
  }
}
