import { createHash } from 'node:crypto';
import {
  isNodeCommand,
  type BuildRequest,
  type BuildResult,
  type ContainerSpec,
  type ContainerState,
  type NodeRequestEnvelope,
  type NodeResponseEnvelope,
} from '@ogulix/shared';

export interface NodeTransport {
  send<TResponse = unknown>(
    targetHost: string,
    command: NodeRequestEnvelope,
  ): Promise<NodeResponseEnvelope<TResponse>>;
}

/**
 * Restricted SSH adapter boundary.
 *
 * Real IAAS SSH transport invokes only the forced command `/usr/local/bin/ogulix-node`
 * over a dedicated non-root deploy user and rejects any verb outside NODE_COMMANDS.
 * Live SSH execution remains disabled until IAAS hosts are prepared and approved.
 */
export class SshAdapter implements NodeTransport {
  constructor(
    private readonly port: number = 22,
    private readonly username: string = 'ogulix-node',
    private readonly privateKeyPath?: string,
  ) {}

  async send<TResponse = unknown>(
    targetHost: string,
    command: NodeRequestEnvelope,
  ): Promise<NodeResponseEnvelope<TResponse>> {
    if (!isNodeCommand(command.command)) {
      return {
        ok: false,
        error: {
          code: 'UNKNOWN_COMMAND',
          message: 'Command is not in the runtime node allowlist',
        },
      };
    }

    throw new Error(
      `IAAS SSH transport is not enabled yet for ${this.getTarget(targetHost)} (${command.command})`,
    );
  }

  getTarget(host: string): string {
    const keyHint = this.privateKeyPath ? ' [key-configured]' : '';
    return `${this.username}@${host}:${this.port}${keyHint}`;
  }
}

/**
 * Deterministic in-memory runtime transport used in RUNTIME_MODE=mock and tests.
 * Never opens network sockets or touches IAAS hosts.
 */
export class MockSshAdapter implements NodeTransport {
  readonly containers = new Map<string, ContainerState>();

  async send<TResponse = unknown>(
    targetHost: string,
    request: NodeRequestEnvelope,
  ): Promise<NodeResponseEnvelope<TResponse>> {
    if (!isNodeCommand(request.command)) {
      return {
        ok: false,
        error: {
          code: 'UNKNOWN_COMMAND',
          message: 'Command is not in the runtime node allowlist',
        },
      };
    }

    switch (request.command) {
      case 'node-info':
        return {
          ok: true,
          data: {
            hostname: targetHost,
            cpuCores: 2,
            memoryTotalMb: 2048,
            memoryAvailableMb: 1536,
            diskAvailableMb: 10240,
            dockerVersion: 'mock-27.0',
          } as TResponse,
        };
      case 'build': {
        const payload = request.payload as BuildRequest;
        const digest = createHash('sha256')
          .update(`${payload.deploymentId}:${payload.sourceRepository}:${payload.branch}`)
          .digest('hex');
        const result: BuildResult = {
          imageReference: payload.imageReference,
          imageDigest: `sha256:${digest}`,
          durationSeconds: 1,
        };
        return { ok: true, data: result as TResponse };
      }
      case 'container-upsert': {
        const spec = request.payload as ContainerSpec;
        this.containers.set(spec.name, {
          id: `mock-${spec.name}`,
          name: spec.name,
          status: 'created',
          health: 'none',
        });
        return { ok: true, data: { name: spec.name } as TResponse };
      }
      case 'container-start': {
        const { name } = request.payload as { name: string };
        const existing = this.containers.get(name);
        this.containers.set(name, {
          id: existing?.id ?? `mock-${name}`,
          name,
          status: 'running',
          health: 'healthy',
        });
        return { ok: true, data: { name, status: 'running' } as TResponse };
      }
      case 'container-stop': {
        const { name } = request.payload as { name: string };
        const existing = this.containers.get(name);
        if (existing) {
          this.containers.set(name, { ...existing, status: 'exited', health: 'none' });
        }
        return { ok: true, data: { name, status: 'exited' } as TResponse };
      }
      case 'container-remove': {
        const { name } = request.payload as { name: string };
        this.containers.delete(name);
        return { ok: true, data: { name, removed: true } as TResponse };
      }
      case 'container-inspect': {
        const { name } = request.payload as { name: string };
        const state = this.containers.get(name);
        if (!state) {
          return {
            ok: false,
            error: { code: 'NOT_FOUND', message: 'Container not found' },
          };
        }
        return { ok: true, data: state as TResponse };
      }
      case 'logs':
        return { ok: true, data: { lines: [], truncated: false } as TResponse };
      case 'cleanup':
        return { ok: true, data: { reclaimedMb: 0 } as TResponse };
    }
  }
}
