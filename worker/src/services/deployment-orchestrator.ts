import {
  DEPLOYMENT_STATUSES,
  isTerminalDeploymentStatus,
  type ContainerSpec,
  type DeployJobPayload,
  type DeploymentErrorCode,
  type DeploymentStatus,
  type RestartJobPayload,
  type StopJobPayload,
} from '@ogulix/shared';
import { decryptSecret } from '@ogulix/shared/server/crypto';
import type { DockerAdapter } from '../adapters/docker.adapter';
import type { TraefikRouteAdapter } from '../adapters/traefik-config.adapter';
import { logger } from '../logging';
import type {
  WorkerDeploymentContext,
  WorkerDeploymentRepository,
} from '../repositories/deployment.repository';
import type { BuildService } from './build-service';
import type { HealthChecker } from './health-check-service';
import type { NodeScheduler } from './node-scheduler';

export type OrchestratorOptions = {
  encryptionKey?: string;
};

function containerNameFor(deploymentId: string): string {
  return `ogulix-dep-${deploymentId}`;
}

export class DeploymentOrchestrator {
  constructor(
    private readonly repository: WorkerDeploymentRepository,
    private readonly scheduler: NodeScheduler,
    private readonly buildService: BuildService,
    private readonly docker: DockerAdapter,
    private readonly healthCheck: HealthChecker,
    private readonly traefik: TraefikRouteAdapter,
    private readonly options: OrchestratorOptions = {},
  ) {}

  getAllowedStatuses(): readonly string[] {
    return DEPLOYMENT_STATUSES;
  }

  async executeDeploy(payload: DeployJobPayload): Promise<void> {
    const requestId = payload.requestId ?? `job-${payload.deploymentId}`;
    const context = await this.repository.findDeploymentContext(payload.deploymentId);
    if (!context) {
      logger.warn('deployment not found for job', {
        requestId,
        deploymentId: payload.deploymentId,
      });
      return;
    }

    if (context.status !== 'QUEUED') {
      logger.info('skipping non-queued deployment job', {
        requestId,
        deploymentId: context.id,
        status: context.status,
      });
      return;
    }

    const { envMap, secretValues } = this.resolveEnvironment(context);
    let currentStatus: DeploymentStatus = 'QUEUED';
    let targetHost: string | null = null;
    const containerName = containerNameFor(context.id);

    const log = (level: 'INFO' | 'WARN' | 'ERROR', stream: 'BUILD' | 'SYSTEM', message: string) =>
      this.repository.appendLog(context.id, { level, stream, message }, secretValues);

    const fail = async (errorCode: DeploymentErrorCode, reason: string): Promise<void> => {
      await log('ERROR', 'SYSTEM', reason);
      if (targetHost) {
        await this.docker.stopContainer(targetHost, requestId, containerName).catch(() => {});
        await this.docker.removeContainer(targetHost, requestId, containerName).catch(() => {});
      }
      if (!isTerminalDeploymentStatus(currentStatus) && currentStatus !== 'QUEUED') {
        await this.repository.transitionStatus(context.id, currentStatus, 'FAILED', {
          errorCode,
          finishedAt: new Date(),
          allocatedPort: null,
        });
      }
    };

    try {
      const movedToPreparing = await this.repository.transitionStatus(
        context.id,
        'QUEUED',
        'PREPARING',
        { startedAt: new Date() },
      );
      if (!movedToPreparing) {
        return;
      }
      currentStatus = 'PREPARING';
      await log('INFO', 'SYSTEM', 'Preparing deployment and selecting runtime node');

      const nodes = await this.repository.listSchedulableNodes();
      const allocation = this.scheduler.selectNode(nodes, {
        cpuCores: context.application.cpuCores,
        memoryMb: context.application.memoryMb,
      });
      if (!allocation) {
        await fail('NODE_UNAVAILABLE', 'No healthy runtime node with enough capacity is available');
        return;
      }

      targetHost = allocation.node.host;
      await log(
        'INFO',
        'SYSTEM',
        `Scheduled on node ${allocation.node.name} using allocated port ${allocation.allocatedPort}`,
      );

      const movedToBuilding = await this.repository.transitionStatus(
        context.id,
        'PREPARING',
        'BUILDING',
        {
          runtimeNodeId: allocation.node.id,
          allocatedPort: allocation.allocatedPort,
        },
      );
      if (!movedToBuilding) {
        return;
      }
      currentStatus = 'BUILDING';
      await log(
        'INFO',
        'BUILD',
        `Building image from ${context.application.dockerfilePath} (context ${context.application.buildContext})`,
      );

      let buildResult;
      try {
        buildResult = await this.buildService.build(targetHost, requestId, context);
      } catch (error) {
        const code: DeploymentErrorCode =
          error instanceof Error && error.message === 'BUILD_TIMEOUT'
            ? 'BUILD_TIMEOUT'
            : 'BUILD_FAILED';
        await fail(code, 'Image build failed on the selected runtime node');
        return;
      }

      await log('INFO', 'BUILD', `Image build finished in ${buildResult.durationSeconds}s`);

      const movedToStarting = await this.repository.transitionStatus(
        context.id,
        'BUILDING',
        'STARTING',
        {
          imageReference: buildResult.imageReference,
          imageDigest: buildResult.imageDigest,
        },
      );
      if (!movedToStarting) {
        return;
      }
      currentStatus = 'STARTING';

      const containerSpec: ContainerSpec = {
        name: containerName,
        imageReference: buildResult.imageReference,
        internalPort: context.application.internalPort,
        hostPort: allocation.allocatedPort,
        cpuCores: context.application.cpuCores,
        memoryMb: context.application.memoryMb,
        pidsLimit: context.application.pidsLimit,
        restartPolicy: 'unless-stopped',
        env: envMap,
        labels: {
          'ogulix.application_id': context.applicationId,
          'ogulix.deployment_id': context.id,
        },
      };

      try {
        await this.docker.upsertContainer(targetHost, requestId, containerSpec);
        await this.docker.startContainer(targetHost, requestId, containerName);
      } catch {
        await fail('CONTAINER_START_FAILED', 'Container failed to start on runtime node');
        return;
      }

      const movedToHealthChecking = await this.repository.transitionStatus(
        context.id,
        'STARTING',
        'HEALTH_CHECKING',
      );
      if (!movedToHealthChecking) {
        return;
      }
      currentStatus = 'HEALTH_CHECKING';
      await log('INFO', 'SYSTEM', `Checking health at ${context.application.healthCheckPath}`);

      const healthy = await this.healthCheck.check({
        host: targetHost,
        port: allocation.allocatedPort,
        path: context.application.healthCheckPath,
      });
      if (!healthy) {
        await fail('HEALTH_CHECK_FAILED', 'Health check failed for newly started container');
        return;
      }

      if (context.activeHostnames.length > 0) {
        try {
          await this.traefik.writeRoute({
            applicationId: context.applicationId,
            hostnames: context.activeHostnames,
            targetHost,
            targetPort: allocation.allocatedPort,
          });
        } catch {
          await fail('ROUTE_FAILED', 'Failed to update reverse proxy routes');
          return;
        }
      }

      await this.repository.transitionStatus(context.id, 'HEALTH_CHECKING', 'RUNNING', {
        finishedAt: new Date(),
      });
      currentStatus = 'RUNNING';
      await log('INFO', 'SYSTEM', 'Deployment is now running');

      // B7b: at most one deployment per application may be RUNNING at a time.
      const previousRunning = await this.repository.findRunningDeployments(
        context.applicationId,
        context.id,
      );
      for (const previous of previousRunning) {
        await this.stopPreviousDeployment(previous.id, previous.runtimeNodeHost, requestId);
      }
    } catch (error) {
      logger.error('unexpected error during deploy execution', {
        requestId,
        deploymentId: context.id,
        error: error instanceof Error ? error.name : 'UnknownError',
      });
      await fail('INTERNAL_ERROR', 'Unexpected internal error interrupted the deployment');
    }
  }

  async executeStop(payload: StopJobPayload): Promise<void> {
    const requestId = payload.requestId ?? `stop-${payload.deploymentId}`;
    const context = await this.repository.findDeploymentContext(payload.deploymentId);
    if (!context || context.status !== 'STOPPING') {
      return;
    }

    const host = context.runtimeNodeId
      ? await this.repository.findRuntimeNodeHost(context.runtimeNodeId)
      : null;

    try {
      const containerName = containerNameFor(context.id);
      if (host) {
        await this.docker.stopContainer(host, requestId, containerName);
        await this.docker.removeContainer(host, requestId, containerName);
      }

      const otherRunning = await this.repository.findRunningDeployments(
        context.applicationId,
        context.id,
      );
      if (otherRunning.length === 0) {
        await this.traefik.removeRoute(context.applicationId);
      }

      await this.repository.transitionStatus(context.id, 'STOPPING', 'STOPPED', {
        finishedAt: new Date(),
        allocatedPort: null,
      });
      await this.repository.appendLog(context.id, {
        level: 'INFO',
        stream: 'SYSTEM',
        message: 'Deployment stopped cleanly',
      });
    } catch (error) {
      logger.error('failed to stop deployment', {
        requestId,
        deploymentId: context.id,
        error: error instanceof Error ? error.name : 'UnknownError',
      });
      await this.repository.transitionStatus(context.id, 'STOPPING', 'FAILED', {
        errorCode: 'INTERNAL_ERROR',
        finishedAt: new Date(),
        allocatedPort: null,
      });
    }
  }

  async executeRestart(payload: RestartJobPayload): Promise<void> {
    await this.executeDeploy({
      kind: 'deploy',
      deploymentId: payload.deploymentId,
      applicationId: payload.applicationId,
      requestedByUserId: payload.requestedByUserId,
      requestId: payload.requestId,
    });
  }

  private async stopPreviousDeployment(
    deploymentId: string,
    host: string | null,
    requestId: string,
  ): Promise<void> {
    const moved = await this.repository.transitionStatus(deploymentId, 'RUNNING', 'STOPPING');
    if (!moved) {
      return;
    }

    const containerName = containerNameFor(deploymentId);
    if (host) {
      await this.docker.stopContainer(host, requestId, containerName).catch(() => {});
      await this.docker.removeContainer(host, requestId, containerName).catch(() => {});
    }

    await this.repository.transitionStatus(deploymentId, 'STOPPING', 'STOPPED', {
      finishedAt: new Date(),
      allocatedPort: null,
    });
    await this.repository.appendLog(deploymentId, {
      level: 'INFO',
      stream: 'SYSTEM',
      message: 'Superseded by a newer healthy deployment',
    });
  }

  private resolveEnvironment(context: WorkerDeploymentContext): {
    envMap: Record<string, string>;
    secretValues: string[];
  } {
    const envMap: Record<string, string> = {};
    const secretValues: string[] = [];

    if (context.encryptedEnvVars.length === 0) {
      return { envMap, secretValues };
    }
    if (!this.options.encryptionKey) {
      throw new Error(
        'ENV_ENCRYPTION_KEY is required to decrypt application environment variables',
      );
    }

    for (const entry of context.encryptedEnvVars) {
      const value = decryptSecret(entry.encryptedValue, this.options.encryptionKey);
      envMap[entry.key] = value;
      if (entry.isSecret && value.length > 0) {
        secretValues.push(value);
      }
    }

    return { envMap, secretValues };
  }
}
