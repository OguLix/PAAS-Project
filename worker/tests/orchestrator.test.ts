import { describe, expect, it } from 'vitest';
import type { DeploymentStatus } from '@ogulix/shared';
import { encryptSecret, generateEncryptionKey } from '@ogulix/shared/server/crypto';
import { assertDeploymentTransition } from '@ogulix/shared/server/state';
import { BuildkitAdapter } from '../src/adapters/buildkit.adapter';
import { DockerAdapter } from '../src/adapters/docker.adapter';
import { MockSshAdapter } from '../src/adapters/ssh.adapter';
import { MockTraefikConfigAdapter } from '../src/adapters/traefik-config.adapter';
import type {
  DeploymentLogWrite,
  DeploymentTransitionPatch,
  RunningDeploymentSummary,
  SchedulableNode,
  WorkerDeploymentContext,
  WorkerDeploymentRepository,
} from '../src/repositories/deployment.repository';
import { BuildService } from '../src/services/build-service';
import { DeploymentOrchestrator } from '../src/services/deployment-orchestrator';
import { HealthCheckService } from '../src/services/health-check-service';
import { MIN_ALLOCATED_PORT, NodeScheduler } from '../src/services/node-scheduler';

class MemoryWorkerRepository implements WorkerDeploymentRepository {
  readonly contexts = new Map<string, WorkerDeploymentContext>();
  readonly nodes: SchedulableNode[] = [];
  readonly logs: Array<{ deploymentId: string; entry: DeploymentLogWrite }> = [];
  readonly transitions: Array<{
    deploymentId: string;
    from: DeploymentStatus;
    to: DeploymentStatus;
  }> = [];

  async findDeploymentContext(deploymentId: string): Promise<WorkerDeploymentContext | null> {
    return this.contexts.get(deploymentId) ?? null;
  }

  async findRuntimeNodeHost(nodeId: string): Promise<string | null> {
    return this.nodes.find((node) => node.id === nodeId)?.host ?? null;
  }

  async listSchedulableNodes(): Promise<SchedulableNode[]> {
    return this.nodes;
  }

  async findRunningDeployments(
    applicationId: string,
    excludeDeploymentId?: string,
  ): Promise<RunningDeploymentSummary[]> {
    return [...this.contexts.values()]
      .filter(
        (ctx) =>
          ctx.applicationId === applicationId &&
          ctx.status === 'RUNNING' &&
          ctx.id !== excludeDeploymentId,
      )
      .map((ctx) => ({
        id: ctx.id,
        runtimeNodeId: ctx.runtimeNodeId,
        runtimeNodeHost: this.nodes.find((node) => node.id === ctx.runtimeNodeId)?.host ?? null,
        allocatedPort: ctx.allocatedPort,
      }));
  }

  async transitionStatus(
    deploymentId: string,
    from: DeploymentStatus,
    to: DeploymentStatus,
    patch: DeploymentTransitionPatch = {},
  ): Promise<boolean> {
    assertDeploymentTransition(from, to);
    const current = this.contexts.get(deploymentId);
    if (!current || current.status !== from) {
      return false;
    }

    this.transitions.push({ deploymentId, from, to });
    this.contexts.set(deploymentId, {
      ...current,
      status: to,
      runtimeNodeId:
        patch.runtimeNodeId !== undefined ? patch.runtimeNodeId : current.runtimeNodeId,
      allocatedPort:
        patch.allocatedPort !== undefined ? patch.allocatedPort : current.allocatedPort,
    });
    return true;
  }

  async appendLog(deploymentId: string, entry: DeploymentLogWrite): Promise<boolean> {
    this.logs.push({ deploymentId, entry });
    return true;
  }
}

describe('NodeScheduler', () => {
  it('selects an online node respecting 512 MiB host headroom and allocates an unused port', () => {
    const scheduler = new NodeScheduler();
    const allocation = scheduler.selectNode(
      [
        {
          id: 'node-1',
          name: 'mock-node-1',
          host: '127.0.0.1',
          sshPort: 22,
          status: 'ONLINE',
          capacityCpuMillicores: 2000,
          capacityMemoryMb: 2048,
          allocatedCpuMillicores: 500,
          allocatedMemoryMb: 1024,
          allocatedPorts: [MIN_ALLOCATED_PORT],
        },
        {
          id: 'node-2',
          name: 'mock-node-2',
          host: '127.0.0.1',
          sshPort: 22,
          status: 'ONLINE',
          capacityCpuMillicores: 2000,
          capacityMemoryMb: 2048,
          allocatedCpuMillicores: 0,
          allocatedMemoryMb: 0,
          allocatedPorts: [MIN_ALLOCATED_PORT],
        },
      ],
      { cpuCores: 0.5, memoryMb: 512 },
    );

    expect(allocation?.node.id).toBe('node-2');
    expect(allocation?.allocatedPort).toBe(MIN_ALLOCATED_PORT + 1);
  });

  it('returns null when no node has enough memory after host reserve', () => {
    const scheduler = new NodeScheduler();
    const allocation = scheduler.selectNode(
      [
        {
          id: 'node-1',
          name: 'mock-node-1',
          host: '127.0.0.1',
          sshPort: 22,
          status: 'ONLINE',
          capacityCpuMillicores: 2000,
          capacityMemoryMb: 1024,
          allocatedCpuMillicores: 0,
          allocatedMemoryMb: 256,
          allocatedPorts: [],
        },
      ],
      { cpuCores: 0.5, memoryMb: 512 },
    );

    expect(allocation).toBeNull();
  });
});

describe('DeploymentOrchestrator (mock runtime)', () => {
  it('runs the full state machine, supersedes previous RUNNING deployment, and clears its port', async () => {
    const repo = new MemoryWorkerRepository();
    const key = generateEncryptionKey();
    repo.nodes.push({
      id: 'node-1',
      name: 'mock-node-1',
      host: '127.0.0.1',
      sshPort: 22,
      status: 'ONLINE',
      capacityCpuMillicores: 2000,
      capacityMemoryMb: 2048,
      allocatedCpuMillicores: 0,
      allocatedMemoryMb: 0,
      allocatedPorts: [30000],
    });

    const appSpec = {
      id: 'app-1',
      name: 'demo',
      sourceRepository: 'https://github.com/ogulix/demo.git',
      defaultBranch: 'main',
      dockerfilePath: 'Dockerfile',
      buildContext: '.',
      internalPort: 3000,
      healthCheckPath: '/health',
      cpuCores: 0.5,
      memoryMb: 512,
      pidsLimit: 100,
    };

    repo.contexts.set('dep-old', {
      id: 'dep-old',
      applicationId: 'app-1',
      runtimeNodeId: 'node-1',
      status: 'RUNNING',
      branch: 'main',
      commitSha: null,
      allocatedPort: 30000,
      application: appSpec,
      activeHostnames: ['demo.apps.ogulix.tech'],
      encryptedEnvVars: [],
    });

    repo.contexts.set('dep-new', {
      id: 'dep-new',
      applicationId: 'app-1',
      runtimeNodeId: null,
      status: 'QUEUED',
      branch: 'main',
      commitSha: 'abcdef1',
      allocatedPort: null,
      application: appSpec,
      activeHostnames: ['demo.apps.ogulix.tech'],
      encryptedEnvVars: [
        {
          key: 'API_TOKEN',
          encryptedValue: encryptSecret('secret-token-xyz', key),
          isSecret: true,
        },
      ],
    });

    const ssh = new MockSshAdapter();
    const traefik = new MockTraefikConfigAdapter();
    const orchestrator = new DeploymentOrchestrator(
      repo,
      new NodeScheduler(),
      new BuildService(new BuildkitAdapter(ssh)),
      new DockerAdapter(ssh),
      new HealthCheckService('mock'),
      traefik,
      { encryptionKey: key },
    );

    await orchestrator.executeDeploy({
      kind: 'deploy',
      deploymentId: 'dep-new',
      applicationId: 'app-1',
      requestedByUserId: 'user-1',
      requestId: 'req-1',
    });

    expect(repo.contexts.get('dep-new')?.status).toBe('RUNNING');
    expect(repo.contexts.get('dep-new')?.allocatedPort).toBe(30001);
    expect(repo.contexts.get('dep-old')?.status).toBe('STOPPED');
    expect(repo.contexts.get('dep-old')?.allocatedPort).toBeNull();
    expect(traefik.routes.get('app-1')?.targetPort).toBe(30001);

    // Stop the active deployment cleanly and free its port.
    await repo.transitionStatus('dep-new', 'RUNNING', 'STOPPING');
    await orchestrator.executeStop({
      kind: 'stop',
      deploymentId: 'dep-new',
      applicationId: 'app-1',
      requestedByUserId: 'user-1',
      requestId: 'req-2',
    });

    expect(repo.contexts.get('dep-new')?.status).toBe('STOPPED');
    expect(repo.contexts.get('dep-new')?.allocatedPort).toBeNull();
    expect(traefik.routes.has('app-1')).toBe(false);
  });

  it('fails cleanly when no node is available and never leaves a dangling port', async () => {
    const repo = new MemoryWorkerRepository();
    repo.contexts.set('dep-1', {
      id: 'dep-1',
      applicationId: 'app-1',
      runtimeNodeId: null,
      status: 'QUEUED',
      branch: 'main',
      commitSha: null,
      allocatedPort: null,
      application: {
        id: 'app-1',
        name: 'demo',
        sourceRepository: 'https://github.com/ogulix/demo.git',
        defaultBranch: 'main',
        dockerfilePath: 'Dockerfile',
        buildContext: '.',
        internalPort: 3000,
        healthCheckPath: '/',
        cpuCores: 0.5,
        memoryMb: 512,
        pidsLimit: 100,
      },
      activeHostnames: [],
      encryptedEnvVars: [],
    });

    const ssh = new MockSshAdapter();
    const orchestrator = new DeploymentOrchestrator(
      repo,
      new NodeScheduler(),
      new BuildService(new BuildkitAdapter(ssh)),
      new DockerAdapter(ssh),
      new HealthCheckService('mock'),
      new MockTraefikConfigAdapter(),
    );

    await orchestrator.executeDeploy({
      kind: 'deploy',
      deploymentId: 'dep-1',
      applicationId: 'app-1',
      requestedByUserId: 'user-1',
      requestId: 'req-fail',
    });

    expect(repo.contexts.get('dep-1')?.status).toBe('FAILED');
    expect(repo.contexts.get('dep-1')?.allocatedPort).toBeNull();
  });
});
