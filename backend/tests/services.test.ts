import { describe, expect, it } from 'vitest';
import {
  ACTIVE_DEPLOYMENT_STATUSES,
  DEFAULT_APPLICATION_CONFIG,
  type CreateApplicationInput,
  type DeploymentJobPayload,
  type DeploymentStatus,
  type UpdateApplicationInput,
} from '@ogulix/shared';
import { decryptSecret, generateEncryptionKey } from '@ogulix/shared/server/crypto';
import type { AuditEventInput, AuditLogger } from '../src/common/audit/audit-logger';
import type {
  ApplicationActor,
  ApplicationListQuery,
  ApplicationRecord,
  ApplicationRepository,
} from '../src/modules/applications/application.repository';
import { ApplicationService } from '../src/modules/applications/application.service';
import type { DeploymentQueueProducer } from '../src/modules/deployments/deployment.queue';
import type {
  DeploymentLogQuery,
  DeploymentLogRecord,
  DeploymentRecord,
  DeploymentRepository,
  NewDeploymentRecord,
} from '../src/modules/deployments/deployment.repository';
import { DeploymentService } from '../src/modules/deployments/deployment.service';
import type {
  EnvironmentVariableRecord,
  EnvironmentVariableRepository,
} from '../src/modules/env/env.repository';
import { EnvironmentVariableService } from '../src/modules/env/env.service';
import type { NodeRepository, RuntimeNodeRecord } from '../src/modules/nodes/node.repository';
import { NodeService } from '../src/modules/nodes/node.service';

class MemoryAuditLogger implements AuditLogger {
  readonly events: AuditEventInput[] = [];
  async record(event: AuditEventInput): Promise<void> {
    this.events.push(event);
  }
}

class MemoryDeploymentRepository implements DeploymentRepository {
  readonly records = new Map<string, DeploymentRecord>();
  readonly logs: DeploymentLogRecord[] = [];

  async listByApplication(
    applicationId: string,
    query: { skip: number; take: number },
  ): Promise<DeploymentRecord[]> {
    return [...this.records.values()]
      .filter((record) => record.applicationId === applicationId)
      .slice(query.skip, query.skip + query.take);
  }

  async countByApplication(applicationId: string): Promise<number> {
    return [...this.records.values()].filter((record) => record.applicationId === applicationId)
      .length;
  }

  async findById(deploymentId: string): Promise<DeploymentRecord | null> {
    return this.records.get(deploymentId) ?? null;
  }

  async findByIdempotencyKey(
    applicationId: string,
    idempotencyKey: string,
  ): Promise<DeploymentRecord | null> {
    return (
      [...this.records.values()].find(
        (record) =>
          record.applicationId === applicationId && record.idempotencyKey === idempotencyKey,
      ) ?? null
    );
  }

  async create(input: NewDeploymentRecord): Promise<DeploymentRecord> {
    const record: DeploymentRecord = {
      id: `dep-${this.records.size + 1}`,
      applicationId: input.applicationId,
      runtimeNodeId: null,
      status: 'QUEUED',
      branch: input.branch,
      commitSha: input.commitSha,
      idempotencyKey: input.idempotencyKey,
      requestFingerprint: input.requestFingerprint,
      requestedByUserId: input.requestedByUserId,
      errorCode: null,
      createdAt: new Date(),
      startedAt: null,
      finishedAt: null,
    };
    this.records.set(record.id, record);
    return record;
  }

  async transitionStatus(
    deploymentId: string,
    from: DeploymentStatus,
    to: DeploymentStatus,
    extra: {
      errorCode?: string | null;
      finishedAt?: Date | null;
    } = {},
  ): Promise<DeploymentRecord | null> {
    const current = this.records.get(deploymentId);
    if (!current || current.status !== from) {
      return null;
    }
    const updated: DeploymentRecord = {
      ...current,
      status: to,
      errorCode: extra.errorCode !== undefined ? extra.errorCode : current.errorCode,
      finishedAt: extra.finishedAt !== undefined ? extra.finishedAt : current.finishedAt,
    };
    this.records.set(deploymentId, updated);
    return updated;
  }

  async listLogsByDeployment(
    deploymentId: string,
    query: DeploymentLogQuery,
  ): Promise<DeploymentLogRecord[]> {
    return this.logs
      .filter(
        (entry) =>
          entry.deploymentId === deploymentId &&
          (query.after === undefined || entry.sequence > query.after),
      )
      .slice(0, query.limit);
  }

  async listLogsByApplication(
    applicationId: string,
    query: DeploymentLogQuery,
  ): Promise<DeploymentLogRecord[]> {
    const latest = [...this.records.values()]
      .filter((record) => record.applicationId === applicationId)
      .at(-1);
    return latest ? this.listLogsByDeployment(latest.id, query) : [];
  }
}

class MemoryApplicationRepository implements ApplicationRepository {
  readonly records = new Map<string, ApplicationRecord>();

  constructor(private readonly deployments: MemoryDeploymentRepository) {}

  async list(query: ApplicationListQuery): Promise<ApplicationRecord[]> {
    return [...this.records.values()]
      .filter(
        (application) =>
          application.status === 'ACTIVE' &&
          (!query.ownerId || application.ownerId === query.ownerId),
      )
      .slice(query.skip, query.skip + query.take);
  }

  async count(ownerId?: string): Promise<number> {
    return [...this.records.values()].filter(
      (application) =>
        application.status === 'ACTIVE' && (!ownerId || application.ownerId === ownerId),
    ).length;
  }

  async findActiveById(applicationId: string): Promise<ApplicationRecord | null> {
    const application = this.records.get(applicationId);
    return application?.status === 'ACTIVE' ? application : null;
  }

  async hasActiveDeployments(applicationId: string): Promise<boolean> {
    return [...this.deployments.records.values()].some(
      (deployment) =>
        deployment.applicationId === applicationId &&
        (ACTIVE_DEPLOYMENT_STATUSES as readonly string[]).includes(deployment.status),
    );
  }

  async create(ownerId: string, input: CreateApplicationInput): Promise<ApplicationRecord> {
    const now = new Date();
    const record: ApplicationRecord = {
      id: `app-${this.records.size + 1}`,
      ownerId,
      ...DEFAULT_APPLICATION_CONFIG,
      ...input,
      status: 'ACTIVE',
      currentDeploymentId: null,
      createdAt: now,
      updatedAt: now,
    };
    this.records.set(record.id, record);
    return record;
  }

  async update(applicationId: string, input: UpdateApplicationInput): Promise<ApplicationRecord> {
    const current = this.records.get(applicationId)!;
    const updated = { ...current, ...input, updatedAt: new Date() };
    this.records.set(applicationId, updated);
    return updated;
  }

  async archive(applicationId: string): Promise<ApplicationRecord> {
    const current = this.records.get(applicationId)!;
    const archived = { ...current, status: 'ARCHIVED' as const, updatedAt: new Date() };
    this.records.set(applicationId, archived);
    return archived;
  }
}

class MemoryEnvRepository implements EnvironmentVariableRepository {
  readonly stored = new Map<string, EnvironmentVariableRecord & { encryptedValue: string }>();

  async listByApplication(applicationId: string): Promise<EnvironmentVariableRecord[]> {
    return [...this.stored.values()]
      .filter((entry) => entry.applicationId === applicationId)
      .map(({ encryptedValue: _encryptedValue, ...summary }) => summary);
  }

  async upsert(
    applicationId: string,
    key: string,
    encryptedValue: string,
    isSecret: boolean,
  ): Promise<EnvironmentVariableRecord> {
    const mapKey = `${applicationId}:${key}`;
    const existing = this.stored.get(mapKey);
    const now = new Date();
    const record = {
      id: existing?.id ?? `env-${this.stored.size + 1}`,
      applicationId,
      key,
      encryptedValue,
      isSecret,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.stored.set(mapKey, record);
    const { encryptedValue: _encrypted, ...summary } = record;
    return summary;
  }

  async deleteByKey(applicationId: string, key: string): Promise<boolean> {
    return this.stored.delete(`${applicationId}:${key}`);
  }
}

class MemoryNodeRepository implements NodeRepository {
  async list(): Promise<RuntimeNodeRecord[]> {
    const now = new Date();
    return [
      {
        id: 'node-1',
        name: 'mock-node-1',
        status: 'ONLINE',
        capacityCpuMillicores: 2000,
        capacityMemoryMb: 2048,
        lastHeartbeatAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ];
  }
}

const owner: ApplicationActor = { userId: 'user-1', role: 'USER' };
const stranger: ApplicationActor = { userId: 'user-2', role: 'USER' };

describe('Sprint B backend services', () => {
  it('blocks archiving an application with an active deployment (B7d) and allows it after cancel', async () => {
    const deploymentRepo = new MemoryDeploymentRepository();
    const appRepo = new MemoryApplicationRepository(deploymentRepo);
    const audit = new MemoryAuditLogger();
    const enqueued: DeploymentJobPayload[] = [];
    const queue: DeploymentQueueProducer = {
      async enqueue(payload) {
        enqueued.push(payload);
      },
    };
    const appService = new ApplicationService(appRepo, audit);
    const deploymentService = new DeploymentService(deploymentRepo, appService, queue, audit);

    const app = await appService.create(
      owner,
      {
        name: 'web',
        sourceRepository: 'https://github.com/ogulix/web.git',
        defaultBranch: 'main',
      },
      'req-1',
    );
    const dep = await deploymentService.create(owner, app.id, {}, 'idem-key-0001', 'req-2');

    await expect(appService.archive(owner, app.id, 'req-3')).rejects.toMatchObject({
      status: 409,
      code: 'INVALID_STATE',
    });

    const cancelled = await deploymentService.cancel(owner, dep.id, 'req-4');
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.errorCode).toBe('CANCELLED_BY_USER');

    const archived = await appService.archive(owner, app.id, 'req-5');
    expect(archived.status).toBe('ARCHIVED');
    expect(audit.events.map((event) => event.action)).toEqual([
      'application.create',
      'deployment.create',
      'deployment.cancel',
      'application.archive',
    ]);
  });

  it('enforces idempotency fingerprint (B7a), restart immutability (B7c), ownership, and log redaction', async () => {
    const deploymentRepo = new MemoryDeploymentRepository();
    const appRepo = new MemoryApplicationRepository(deploymentRepo);
    const enqueued: DeploymentJobPayload[] = [];
    const queue: DeploymentQueueProducer = {
      async enqueue(payload) {
        enqueued.push(payload);
      },
    };
    const appService = new ApplicationService(appRepo);
    const deploymentService = new DeploymentService(deploymentRepo, appService, queue);

    const app = await appService.create(
      owner,
      {
        name: 'api',
        sourceRepository: 'https://github.com/ogulix/api.git',
        defaultBranch: 'main',
      },
      'req-1',
    );

    const first = await deploymentService.create(
      owner,
      app.id,
      { branch: 'main' },
      'idem-key-1234',
      'req-2',
    );
    const repeated = await deploymentService.create(
      owner,
      app.id,
      { branch: 'main' },
      'idem-key-1234',
      'req-3',
    );
    expect(repeated.id).toBe(first.id);
    expect(enqueued).toHaveLength(1);

    await expect(
      deploymentService.create(owner, app.id, { branch: 'develop' }, 'idem-key-1234', 'req-4'),
    ).rejects.toMatchObject({ status: 409, code: 'IDEMPOTENCY_CONFLICT' });

    await expect(deploymentService.get(stranger, first.id)).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });

    // Restart creates a brand new attempt while leaving the original attempt immutable.
    const restarted = await deploymentService.restart(owner, first.id, 'req-5');
    expect(restarted.id).not.toBe(first.id);
    expect(restarted.branch).toBe('main');
    expect(enqueued).toHaveLength(2);

    // Logs are redacted on read as defence in depth.
    deploymentRepo.logs.push({
      deploymentId: first.id,
      sequence: 1,
      level: 'INFO',
      stream: 'BUILD',
      message: 'Connecting with password=supersecret',
      createdAt: new Date(),
    });
    const logs = await deploymentService.listDeploymentLogs(owner, first.id, { limit: 100 });
    expect(logs[0]?.message).not.toContain('supersecret');
    expect(logs[0]?.message).toContain('[REDACTED]');

    // Stop is only allowed when RUNNING.
    await expect(deploymentService.stop(owner, first.id, 'req-6')).rejects.toMatchObject({
      status: 409,
      code: 'INVALID_STATE',
    });
    deploymentRepo.records.set(first.id, {
      ...deploymentRepo.records.get(first.id)!,
      status: 'RUNNING',
    });
    const stopping = await deploymentService.stop(owner, first.id, 'req-7');
    expect(stopping.status).toBe('STOPPING');
    expect(enqueued.at(-1)).toMatchObject({ kind: 'stop', deploymentId: first.id });
  });

  it('encrypts environment variables with AES-256-GCM and never returns plaintext', async () => {
    const deploymentRepo = new MemoryDeploymentRepository();
    const appRepo = new MemoryApplicationRepository(deploymentRepo);
    const appService = new ApplicationService(appRepo);
    const envRepo = new MemoryEnvRepository();
    const key = generateEncryptionKey();
    const envService = new EnvironmentVariableService(envRepo, appService, {
      ENV_ENCRYPTION_KEY: key,
    });

    const app = await appService.create(
      owner,
      {
        name: 'worker-app',
        sourceRepository: 'https://github.com/ogulix/worker-app.git',
        defaultBranch: 'main',
      },
      'req-1',
    );

    const saved = await envService.upsert(
      owner,
      app.id,
      'DATABASE_PASSWORD',
      { value: 'my-secret-pass', isSecret: true },
      'req-2',
    );
    expect(saved.key).toBe('DATABASE_PASSWORD');
    expect('value' in saved).toBe(false);

    const stored = envRepo.stored.get(`${app.id}:DATABASE_PASSWORD`);
    expect(stored?.encryptedValue.startsWith('v1:')).toBe(true);
    expect(decryptSecret(stored!.encryptedValue, key)).toBe('my-secret-pass');

    await expect(envService.list(stranger, app.id)).rejects.toMatchObject({ status: 404 });
    const list = await envService.list(owner, app.id);
    expect(list).toHaveLength(1);
    expect(list[0]?.key).toBe('DATABASE_PASSWORD');

    const removed = await envService.remove(owner, app.id, 'DATABASE_PASSWORD', 'req-3');
    expect(removed).toEqual({ key: 'DATABASE_PASSWORD', deleted: true });
  });

  it('lists runtime nodes without exposing private addresses', async () => {
    const nodeService = new NodeService(new MemoryNodeRepository());
    const nodes = await nodeService.list();
    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.name).toBe('mock-node-1');
    expect('host' in nodes[0]!).toBe(false);
    expect('sshPort' in nodes[0]!).toBe(false);
  });
});
