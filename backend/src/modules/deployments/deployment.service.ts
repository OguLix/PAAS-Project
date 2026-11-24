import { createHash } from 'node:crypto';
import {
  getDeploymentErrorMessage,
  isDeploymentErrorCode,
  type DeployInput,
  type DeploymentLogEntry,
  type DeploymentResponse,
} from '@ogulix/shared';
import { assertDeploymentTransition } from '@ogulix/shared/server/state';
import { redactText } from '@ogulix/shared/server/redaction';
import type { ApplicationActor } from '../applications/application.repository';
import type { ApplicationService } from '../applications/application.service';
import { noopAuditLogger, type AuditLogger } from '../../common/audit/audit-logger';
import {
  idempotencyConflict,
  invalidState,
  notFound,
  serviceUnavailable,
} from '../../common/errors/http-error';
import { logger } from '../../common/logger';
import type { DeploymentQueueProducer } from './deployment.queue';
import type {
  DeploymentLogQuery,
  DeploymentLogRecord,
  DeploymentRecord,
  DeploymentRepository,
} from './deployment.repository';

function computeFingerprint(payload: Record<string, unknown>): string {
  const canonical = JSON.stringify(
    Object.fromEntries(
      Object.entries(payload).sort(([left], [right]) => left.localeCompare(right)),
    ),
  );
  return createHash('sha256').update(canonical).digest('hex');
}

export class DeploymentService {
  constructor(
    private readonly repository: DeploymentRepository,
    private readonly applications: ApplicationService,
    private readonly queue: DeploymentQueueProducer,
    private readonly audit: AuditLogger = noopAuditLogger,
  ) {}

  async listByApplication(
    actor: ApplicationActor,
    applicationId: string,
    page: number,
    pageSize: number,
  ): Promise<{ deployments: DeploymentResponse[]; total: number }> {
    await this.applications.assertCanAccess(actor, applicationId);
    const [records, total] = await Promise.all([
      this.repository.listByApplication(applicationId, {
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.repository.countByApplication(applicationId),
    ]);

    return { deployments: records.map((record) => this.toResponse(record)), total };
  }

  async create(
    actor: ApplicationActor,
    applicationId: string,
    input: DeployInput,
    idempotencyKey: string,
    requestId: string,
  ): Promise<DeploymentResponse> {
    const application = await this.applications.assertCanAccess(actor, applicationId);
    const branch = input.branch ?? application.defaultBranch;
    const commitSha = input.commitSha ?? null;

    const fingerprint = computeFingerprint({
      applicationId: application.id,
      branch,
      commitSha,
      dockerfilePath: application.dockerfilePath,
      buildContext: application.buildContext,
      internalPort: application.internalPort,
      healthCheckPath: application.healthCheckPath,
      cpuCores: application.cpuCores,
      memoryMb: application.memoryMb,
      pidsLimit: application.pidsLimit,
    });

    const existing = await this.repository.findByIdempotencyKey(application.id, idempotencyKey);
    if (existing) {
      if (existing.requestFingerprint !== fingerprint) {
        throw idempotencyConflict();
      }
      return this.toResponse(existing);
    }

    const created = await this.repository.create({
      applicationId: application.id,
      branch,
      commitSha,
      idempotencyKey,
      requestFingerprint: fingerprint,
      requestedByUserId: actor.userId,
    });

    if (created.requestFingerprint !== fingerprint) {
      throw idempotencyConflict();
    }

    try {
      await this.queue.enqueue({
        kind: 'deploy',
        deploymentId: created.id,
        applicationId: application.id,
        requestedByUserId: actor.userId,
        requestId,
        sourceBranch: branch,
        ...(commitSha ? { sourceRevision: commitSha } : {}),
      });
    } catch (error) {
      logger.error('failed to enqueue deployment job', {
        requestId,
        deploymentId: created.id,
        error: error instanceof Error ? error.name : 'UnknownError',
      });
      await this.repository.transitionStatus(created.id, 'QUEUED', 'FAILED', {
        errorCode: 'INTERNAL_ERROR',
        finishedAt: new Date(),
        clearAllocatedPort: true,
      });
      throw serviceUnavailable('Deployment queue is temporarily unavailable');
    }

    await this.audit.record({
      actorUserId: actor.userId,
      action: 'deployment.create',
      resourceType: 'DEPLOYMENT',
      resourceId: created.id,
      requestId,
    });

    return this.toResponse(created);
  }

  async get(actor: ApplicationActor, deploymentId: string): Promise<DeploymentResponse> {
    const deployment = await this.requireAccessibleDeployment(actor, deploymentId);
    return this.toResponse(deployment);
  }

  async listDeploymentLogs(
    actor: ApplicationActor,
    deploymentId: string,
    query: DeploymentLogQuery,
  ): Promise<DeploymentLogEntry[]> {
    const deployment = await this.requireAccessibleDeployment(actor, deploymentId);
    const entries = await this.repository.listLogsByDeployment(deployment.id, query);
    return entries.map((entry) => this.toLogEntry(entry));
  }

  async listApplicationLogs(
    actor: ApplicationActor,
    applicationId: string,
    query: DeploymentLogQuery,
  ): Promise<DeploymentLogEntry[]> {
    await this.applications.assertCanAccess(actor, applicationId);
    const entries = await this.repository.listLogsByApplication(applicationId, query);
    return entries.map((entry) => this.toLogEntry(entry));
  }

  async cancel(
    actor: ApplicationActor,
    deploymentId: string,
    requestId: string,
  ): Promise<DeploymentResponse> {
    const deployment = await this.requireAccessibleDeployment(actor, deploymentId);
    if (deployment.status !== 'QUEUED') {
      throw invalidState('Only queued deployments can be cancelled');
    }

    assertDeploymentTransition(deployment.status, 'CANCELLED');
    const updated = await this.repository.transitionStatus(deployment.id, 'QUEUED', 'CANCELLED', {
      errorCode: 'CANCELLED_BY_USER',
      finishedAt: new Date(),
      clearAllocatedPort: true,
    });
    if (!updated) {
      throw invalidState('Deployment is no longer queued and cannot be cancelled');
    }

    await this.audit.record({
      actorUserId: actor.userId,
      action: 'deployment.cancel',
      resourceType: 'DEPLOYMENT',
      resourceId: deployment.id,
      requestId,
    });

    return this.toResponse(updated);
  }

  async stop(
    actor: ApplicationActor,
    deploymentId: string,
    requestId: string,
  ): Promise<DeploymentResponse> {
    const deployment = await this.requireAccessibleDeployment(actor, deploymentId);
    if (deployment.status !== 'RUNNING') {
      throw invalidState('Only running deployments can be stopped');
    }

    assertDeploymentTransition(deployment.status, 'STOPPING');
    const updated = await this.repository.transitionStatus(deployment.id, 'RUNNING', 'STOPPING');
    if (!updated) {
      throw invalidState('Deployment is no longer running and cannot be stopped');
    }

    try {
      await this.queue.enqueue({
        kind: 'stop',
        deploymentId: deployment.id,
        applicationId: deployment.applicationId,
        requestedByUserId: actor.userId,
        requestId,
      });
    } catch (error) {
      logger.error('failed to enqueue stop job', {
        requestId,
        deploymentId: deployment.id,
        error: error instanceof Error ? error.name : 'UnknownError',
      });
      throw serviceUnavailable('Deployment queue is temporarily unavailable');
    }

    await this.audit.record({
      actorUserId: actor.userId,
      action: 'deployment.stop',
      resourceType: 'DEPLOYMENT',
      resourceId: deployment.id,
      requestId,
    });

    return this.toResponse(updated);
  }

  async restart(
    actor: ApplicationActor,
    deploymentId: string,
    requestId: string,
  ): Promise<DeploymentResponse> {
    const original = await this.requireAccessibleDeployment(actor, deploymentId);
    const application = await this.applications.assertCanAccess(actor, original.applicationId);
    const branch = original.branch ?? application.defaultBranch;
    const commitSha = original.commitSha ?? null;

    // B7c: restart always creates a new deployment attempt and leaves history immutable.
    const created = await this.repository.create({
      applicationId: application.id,
      branch,
      commitSha,
      idempotencyKey: null,
      requestFingerprint: null,
      requestedByUserId: actor.userId,
    });

    try {
      await this.queue.enqueue({
        kind: 'deploy',
        deploymentId: created.id,
        applicationId: application.id,
        requestedByUserId: actor.userId,
        requestId,
        sourceBranch: branch,
        ...(commitSha ? { sourceRevision: commitSha } : {}),
      });
    } catch (error) {
      logger.error('failed to enqueue restart deployment job', {
        requestId,
        deploymentId: created.id,
        sourceDeploymentId: original.id,
        error: error instanceof Error ? error.name : 'UnknownError',
      });
      await this.repository.transitionStatus(created.id, 'QUEUED', 'FAILED', {
        errorCode: 'INTERNAL_ERROR',
        finishedAt: new Date(),
        clearAllocatedPort: true,
      });
      throw serviceUnavailable('Deployment queue is temporarily unavailable');
    }

    await this.audit.record({
      actorUserId: actor.userId,
      action: 'deployment.restart',
      resourceType: 'DEPLOYMENT',
      resourceId: created.id,
      requestId,
    });

    return this.toResponse(created);
  }

  private async requireAccessibleDeployment(
    actor: ApplicationActor,
    deploymentId: string,
  ): Promise<DeploymentRecord> {
    const deployment = await this.repository.findById(deploymentId);
    if (!deployment) {
      throw notFound('Deployment not found');
    }
    await this.applications.assertCanAccess(actor, deployment.applicationId);
    return deployment;
  }

  private toResponse(record: DeploymentRecord): DeploymentResponse {
    const errorCode =
      record.errorCode && isDeploymentErrorCode(record.errorCode) ? record.errorCode : null;
    return {
      id: record.id,
      applicationId: record.applicationId,
      runtimeNodeId: record.runtimeNodeId,
      status: record.status,
      branch: record.branch,
      commitSha: record.commitSha,
      createdAt: record.createdAt.toISOString(),
      startedAt: record.startedAt ? record.startedAt.toISOString() : null,
      finishedAt: record.finishedAt ? record.finishedAt.toISOString() : null,
      errorCode,
      errorMessage: getDeploymentErrorMessage(errorCode),
    };
  }

  private toLogEntry(entry: DeploymentLogRecord): DeploymentLogEntry {
    return {
      deploymentId: entry.deploymentId,
      sequence: entry.sequence,
      level: entry.level,
      stream: entry.stream,
      message: redactText(entry.message),
      createdAt: entry.createdAt.toISOString(),
    };
  }
}
