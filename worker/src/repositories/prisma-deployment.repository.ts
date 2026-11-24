import type { PrismaClient } from '@prisma/client';
import { ACTIVE_DEPLOYMENT_STATUSES, type DeploymentStatus } from '@ogulix/shared';
import { redactText } from '@ogulix/shared/server/redaction';
import { assertDeploymentTransition } from '@ogulix/shared/server/state';
import {
  MAX_DEPLOYMENT_LOG_BYTES,
  MAX_DEPLOYMENT_LOG_LINES,
  type DeploymentLogWrite,
  type DeploymentTransitionPatch,
  type RunningDeploymentSummary,
  type SchedulableNode,
  type WorkerDeploymentContext,
  type WorkerDeploymentRepository,
} from './deployment.repository';

export class PrismaWorkerDeploymentRepository implements WorkerDeploymentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findDeploymentContext(deploymentId: string): Promise<WorkerDeploymentContext | null> {
    const deployment = await this.prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: {
        application: {
          include: {
            domains: {
              where: { status: { not: 'DISABLED' } },
              select: { hostname: true },
            },
            environmentVariables: {
              select: { key: true, encryptedValue: true, isSecret: true },
            },
          },
        },
      },
    });
    if (!deployment) {
      return null;
    }

    return {
      id: deployment.id,
      applicationId: deployment.applicationId,
      runtimeNodeId: deployment.runtimeNodeId,
      status: deployment.status,
      branch: deployment.branch,
      commitSha: deployment.commitSha,
      allocatedPort: deployment.allocatedPort,
      application: {
        id: deployment.application.id,
        name: deployment.application.name,
        sourceRepository: deployment.application.sourceRepository,
        defaultBranch: deployment.application.defaultBranch,
        dockerfilePath: deployment.application.dockerfilePath,
        buildContext: deployment.application.buildContext,
        internalPort: deployment.application.internalPort,
        healthCheckPath: deployment.application.healthCheckPath,
        cpuCores: deployment.application.cpuCores,
        memoryMb: deployment.application.memoryMb,
        pidsLimit: deployment.application.pidsLimit,
      },
      activeHostnames: deployment.application.domains.map((domain) => domain.hostname),
      encryptedEnvVars: deployment.application.environmentVariables,
    };
  }

  async findRuntimeNodeHost(nodeId: string): Promise<string | null> {
    const node = await this.prisma.runtimeNode.findUnique({
      where: { id: nodeId },
      select: { host: true },
    });
    return node?.host ?? null;
  }

  async listSchedulableNodes(): Promise<SchedulableNode[]> {
    const nodes = await this.prisma.runtimeNode.findMany({
      where: { status: 'ONLINE' },
      include: {
        deployments: {
          where: { status: { in: [...ACTIVE_DEPLOYMENT_STATUSES] } },
          select: {
            allocatedPort: true,
            application: {
              select: { cpuCores: true, memoryMb: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return nodes.map((node) => ({
      id: node.id,
      name: node.name,
      host: node.host,
      sshPort: node.sshPort,
      status: node.status,
      capacityCpuMillicores: node.capacityCpuMillicores,
      capacityMemoryMb: node.capacityMemoryMb,
      allocatedCpuMillicores: node.deployments.reduce(
        (sum, deployment) => sum + Math.round(deployment.application.cpuCores * 1000),
        0,
      ),
      allocatedMemoryMb: node.deployments.reduce(
        (sum, deployment) => sum + deployment.application.memoryMb,
        0,
      ),
      allocatedPorts: node.deployments
        .map((deployment) => deployment.allocatedPort)
        .filter((port): port is number => port !== null),
    }));
  }

  async findRunningDeployments(
    applicationId: string,
    excludeDeploymentId?: string,
  ): Promise<RunningDeploymentSummary[]> {
    const rows = await this.prisma.deployment.findMany({
      where: {
        applicationId,
        status: 'RUNNING',
        ...(excludeDeploymentId ? { id: { not: excludeDeploymentId } } : {}),
      },
      select: {
        id: true,
        runtimeNodeId: true,
        allocatedPort: true,
        runtimeNode: { select: { host: true } },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      runtimeNodeId: row.runtimeNodeId,
      runtimeNodeHost: row.runtimeNode?.host ?? null,
      allocatedPort: row.allocatedPort,
    }));
  }

  async transitionStatus(
    deploymentId: string,
    from: DeploymentStatus,
    to: DeploymentStatus,
    patch: DeploymentTransitionPatch = {},
  ): Promise<boolean> {
    assertDeploymentTransition(from, to);

    const updated = await this.prisma.deployment.updateMany({
      where: { id: deploymentId, status: from },
      data: {
        status: to,
        ...(patch.runtimeNodeId !== undefined ? { runtimeNodeId: patch.runtimeNodeId } : {}),
        ...(patch.allocatedPort !== undefined ? { allocatedPort: patch.allocatedPort } : {}),
        ...(patch.imageReference !== undefined ? { imageReference: patch.imageReference } : {}),
        ...(patch.imageDigest !== undefined ? { imageDigest: patch.imageDigest } : {}),
        ...(patch.errorCode !== undefined ? { errorCode: patch.errorCode } : {}),
        ...(patch.startedAt !== undefined ? { startedAt: patch.startedAt } : {}),
        ...(patch.finishedAt !== undefined ? { finishedAt: patch.finishedAt } : {}),
      },
    });

    return updated.count === 1;
  }

  async appendLog(
    deploymentId: string,
    entry: DeploymentLogWrite,
    extraSecrets: readonly string[] = [],
  ): Promise<boolean> {
    const redacted = redactText(entry.message, extraSecrets);
    const bytes = Buffer.byteLength(redacted, 'utf8');

    return this.prisma.$transaction(async (transaction) => {
      const deployment = await transaction.deployment.findUnique({
        where: { id: deploymentId },
        select: { logLineCount: true, logByteCount: true },
      });
      if (!deployment) {
        return false;
      }

      if (
        deployment.logLineCount >= MAX_DEPLOYMENT_LOG_LINES ||
        deployment.logByteCount + bytes > MAX_DEPLOYMENT_LOG_BYTES
      ) {
        return false;
      }

      const nextSequence = deployment.logLineCount + 1;
      await transaction.deploymentLog.create({
        data: {
          deploymentId,
          sequence: nextSequence,
          level: entry.level,
          stream: entry.stream,
          message: redacted,
        },
      });

      await transaction.deployment.update({
        where: { id: deploymentId },
        data: {
          logLineCount: nextSequence,
          logByteCount: deployment.logByteCount + bytes,
        },
      });

      return true;
    });
  }
}
