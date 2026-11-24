import { describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  ACTIVE_DEPLOYMENT_STATUSES,
  DEFAULT_APPLICATION_CONFIG,
  type CreateApplicationInput,
  type CreateDomainInput,
  type DeploymentJobPayload,
  type DeploymentStatus,
  type UpdateApplicationInput,
  type AuthUser,
} from '@ogulix/shared';
import { generateEncryptionKey } from '@ogulix/shared/server/crypto';
import type { AppEnv } from '../src/config/env';
import { loadEnv } from '../src/config/env';
import { createApp } from '../src/app';
import type {
  ApplicationListQuery,
  ApplicationRecord,
  ApplicationRepository,
} from '../src/modules/applications/application.repository';
import { ApplicationService } from '../src/modules/applications/application.service';
import type {
  AuthRepository,
  AuthUserRecord,
  NewSession,
  SessionRecord,
} from '../src/modules/auth/auth.repository';
import { AuthService } from '../src/modules/auth/auth.service';
import type { DeploymentQueueProducer } from '../src/modules/deployments/deployment.queue';
import type {
  DeploymentLogQuery,
  DeploymentLogRecord,
  DeploymentRecord,
  DeploymentRepository,
  NewDeploymentRecord,
} from '../src/modules/deployments/deployment.repository';
import { DeploymentService } from '../src/modules/deployments/deployment.service';
import type { DomainRecord, DomainRepository } from '../src/modules/domains/domain.repository';
import { DomainService } from '../src/modules/domains/domain.service';
import type {
  EnvironmentVariableRecord,
  EnvironmentVariableRepository,
} from '../src/modules/env/env.repository';
import { EnvironmentVariableService } from '../src/modules/env/env.service';
import type { NodeRepository, RuntimeNodeRecord } from '../src/modules/nodes/node.repository';
import { NodeService } from '../src/modules/nodes/node.service';

class ApiAuthRepository implements AuthRepository {
  private readonly users = new Map<string, AuthUserRecord>();
  private readonly sessions = new Map<string, SessionRecord>();

  async findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    return [...this.users.values()].find((user) => user.email === email) ?? null;
  }

  async createUser(email: string, passwordHash: string): Promise<AuthUser> {
    const user = {
      id: `user-${this.users.size + 1}`,
      email,
      role: 'USER' as const,
      passwordHash,
    };
    this.users.set(user.id, user);
    return { id: user.id, email: user.email, role: user.role };
  }

  async createSession(session: NewSession): Promise<{ id: string }> {
    const id = `session-${this.sessions.size + 1}`;
    const user = this.users.get(session.userId);
    if (!user) {
      throw new Error('test user is missing');
    }

    this.sessions.set(session.tokenHash, {
      id,
      userId: user.id,
      expiresAt: session.expiresAt,
      lastSeenAt: session.lastSeenAt,
      revokedAt: null,
      user: { id: user.id, email: user.email, role: user.role },
    });
    return { id };
  }

  async findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    return this.sessions.get(tokenHash) ?? null;
  }

  async touchSession(sessionId: string, now: Date, idleCutoff: Date): Promise<boolean> {
    const session = [...this.sessions.values()].find((candidate) => candidate.id === sessionId);
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= now ||
      session.lastSeenAt <= idleCutoff
    ) {
      return false;
    }
    session.lastSeenAt = now;
    return true;
  }

  async revokeSession(sessionId: string, revokedAt: Date): Promise<void> {
    const session = [...this.sessions.values()].find((candidate) => candidate.id === sessionId);
    if (session) {
      session.revokedAt = revokedAt;
    }
  }

  async createAuthAuditEvent(
    _actorUserId: string | null,
    _action: string,
    _requestId: string,
  ): Promise<void> {}
}

class ApiDeploymentRepository implements DeploymentRepository {
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

class ApiApplicationRepository implements ApplicationRepository {
  private readonly records = new Map<string, ApplicationRecord>();

  constructor(private readonly deployments: ApiDeploymentRepository) {}

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
    const application: ApplicationRecord = {
      id: `app-${this.records.size + 1}`,
      ownerId,
      ...DEFAULT_APPLICATION_CONFIG,
      ...input,
      status: 'ACTIVE',
      currentDeploymentId: null,
      createdAt: now,
      updatedAt: now,
    };
    this.records.set(application.id, application);
    return application;
  }

  async update(applicationId: string, input: UpdateApplicationInput): Promise<ApplicationRecord> {
    const application = this.records.get(applicationId);
    if (!application) {
      throw new Error('test application is missing');
    }
    const updated = { ...application, ...input, updatedAt: new Date() };
    this.records.set(applicationId, updated);
    return updated;
  }

  async archive(applicationId: string): Promise<ApplicationRecord> {
    const application = this.records.get(applicationId);
    if (!application) {
      throw new Error('test application is missing');
    }
    const archived = { ...application, status: 'ARCHIVED' as const, updatedAt: new Date() };
    this.records.set(applicationId, archived);
    return archived;
  }
}

class ApiDomainRepository implements DomainRepository {
  private readonly records = new Map<string, DomainRecord>();

  async list(applicationId: string): Promise<DomainRecord[]> {
    return [...this.records.values()].filter((domain) => domain.applicationId === applicationId);
  }

  async create(applicationId: string, input: CreateDomainInput): Promise<DomainRecord> {
    const domain: DomainRecord = {
      id: `domain-${this.records.size + 1}`,
      applicationId,
      hostname: input.hostname,
      isPrimary: this.records.size === 0,
      status: 'PENDING',
      createdAt: new Date(),
    };
    this.records.set(domain.id, domain);
    return domain;
  }

  async findById(domainId: string): Promise<DomainRecord | null> {
    return this.records.get(domainId) ?? null;
  }

  async disable(domainId: string): Promise<DomainRecord> {
    const domain = this.records.get(domainId);
    if (!domain) {
      throw new Error('test domain is missing');
    }
    const disabled = { ...domain, status: 'DISABLED' as const, isPrimary: false };
    this.records.set(domainId, disabled);
    return disabled;
  }
}

class ApiEnvRepository implements EnvironmentVariableRepository {
  readonly stored = new Map<string, EnvironmentVariableRecord & { encryptedValue: string }>();

  async listByApplication(applicationId: string): Promise<EnvironmentVariableRecord[]> {
    return [...this.stored.values()]
      .filter((item) => item.applicationId === applicationId)
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

class ApiNodeRepository implements NodeRepository {
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

function createTestApp(): {
  app: ReturnType<typeof createApp>;
  env: AppEnv;
  enqueued: DeploymentJobPayload[];
} {
  const env = loadEnv({
    NODE_ENV: 'test',
    REGISTRATION_MODE: 'open',
    REDIS_URL: 'redis://127.0.0.1:6379',
    ENV_ENCRYPTION_KEY: generateEncryptionKey(),
  });
  const authRepository = new ApiAuthRepository();
  let tokenNumber = 0;
  const authService = new AuthService(authRepository, env, {
    passwordHasher: {
      hash: async (value) => `hash:${value}`,
      verify: async (hash, value) => hash === `hash:${value}`,
    },
    createToken: () => `${'a'.repeat(42)}${++tokenNumber}`,
  });
  const deploymentRepository = new ApiDeploymentRepository();
  const applicationRepository = new ApiApplicationRepository(deploymentRepository);
  const applicationService = new ApplicationService(applicationRepository);
  const domainService = new DomainService(new ApiDomainRepository(), applicationService);
  const enqueued: DeploymentJobPayload[] = [];
  const queue: DeploymentQueueProducer = {
    async enqueue(payload) {
      enqueued.push(payload);
    },
  };
  const deploymentService = new DeploymentService(deploymentRepository, applicationService, queue);
  const envService = new EnvironmentVariableService(
    new ApiEnvRepository(),
    applicationService,
    env,
  );
  const nodeService = new NodeService(new ApiNodeRepository());
  return {
    env,
    enqueued,
    app: createApp(env, {
      authService,
      applicationService,
      domainService,
      deploymentService,
      envService,
      nodeService,
      checkDatabase: async () => {},
      checkQueue: async () => {},
    }),
  };
}

function sessionCookie(number: number): string {
  return `ogulix_session=${'a'.repeat(42)}${number}`;
}

describe('Backend 1 API', () => {
  it('handles credentialed CORS preflights for only the configured dashboard origin', async () => {
    const { app, env } = createTestApp();
    const allowed = await request(app)
      .options('/api/v1/auth/login')
      .set('Origin', env.APP_ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type');
    expect(allowed.status).toBe(204);
    expect(allowed.headers['access-control-allow-origin']).toBe(env.APP_ORIGIN);
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');

    const denied = await request(app)
      .options('/api/v1/auth/login')
      .set('Origin', 'https://attacker.example')
      .set('Access-Control-Request-Method', 'POST');
    expect(denied.status).toBe(403);
  });

  it('requires a same-origin request for state-changing endpoints', async () => {
    const { app } = createTestApp();
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'person@example.test', password: 'secure-password' });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('logs in with the opaque session cookie without returning the token', async () => {
    const { app, env } = createTestApp();
    await request(app)
      .post('/api/v1/auth/register')
      .set('Origin', env.APP_ORIGIN)
      .send({ email: 'person@example.test', password: 'secure-password' });

    const login = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', env.APP_ORIGIN)
      .send({ email: 'person@example.test', password: 'secure-password' });
    expect(login.status).toBe(200);
    expect(login.body.data.user.id).toBe('user-1');
    expect(JSON.stringify(login.body)).not.toContain('aaaaaaaa');
    expect(login.headers['set-cookie'][0]).toContain('HttpOnly');

    const me = await request(app).get('/api/v1/auth/me').set('Cookie', sessionCookie(2));
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe('person@example.test');
  });

  it('sets an opaque secure cookie and enforces application ownership', async () => {
    const { app, env } = createTestApp();
    const origin = env.APP_ORIGIN;
    const registerUser = (email: string) =>
      request(app)
        .post('/api/v1/auth/register')
        .set('Origin', origin)
        .set('Sec-Fetch-Site', 'same-site')
        .send({ email, password: 'secure-password' });

    const ownerRegistration = await registerUser('owner@example.test');
    expect(ownerRegistration.status).toBe(201);
    expect(ownerRegistration.body.data.user).toMatchObject({
      id: 'user-1',
      email: 'owner@example.test',
      role: 'USER',
    });
    expect(JSON.stringify(ownerRegistration.body)).not.toContain('aaaaaaaa');
    expect(ownerRegistration.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(ownerRegistration.headers['set-cookie'][0]).toContain('Secure');
    expect(ownerRegistration.headers['set-cookie'][0]).toContain('SameSite=Lax');

    const otherRegistration = await registerUser('other@example.test');
    expect(otherRegistration.status).toBe(201);

    const createdApplication = await request(app)
      .post('/api/v1/applications')
      .set('Origin', origin)
      .set('Cookie', sessionCookie(1))
      .send({
        name: 'demo',
        sourceRepository: 'https://github.com/ogulix/demo.git',
        defaultBranch: 'main',
      });

    expect(createdApplication.status).toBe(201);
    expect(createdApplication.body.data.currentDeploymentId).toBeNull();
    expect(createdApplication.body.data).toMatchObject({
      dockerfilePath: 'Dockerfile',
      buildContext: '.',
      internalPort: 3000,
      healthCheckPath: '/',
      cpuCores: 0.5,
      memoryMb: 512,
      pidsLimit: 100,
    });

    const currentUser = await request(app).get('/api/v1/auth/me').set('Cookie', sessionCookie(1));
    expect(currentUser.status).toBe(200);
    expect(currentUser.body.data.user.id).toBe('user-1');

    const ownerDomain = await request(app)
      .post(`/api/v1/applications/${createdApplication.body.data.id}/domains`)
      .set('Origin', origin)
      .set('Cookie', sessionCookie(1))
      .send({ hostname: 'demo.apps.ogulix.tech' });
    expect(ownerDomain.status).toBe(201);

    const foreignRead = await request(app)
      .get(`/api/v1/applications/${createdApplication.body.data.id}`)
      .set('Cookie', sessionCookie(2));
    expect(foreignRead.status).toBe(404);
    expect(foreignRead.body.error.code).toBe('NOT_FOUND');

    const foreignDomainRead = await request(app)
      .get(`/api/v1/applications/${createdApplication.body.data.id}/domains`)
      .set('Cookie', sessionCookie(2));
    expect(foreignDomainRead.status).toBe(404);

    const logout = await request(app)
      .post('/api/v1/auth/logout')
      .set('Origin', origin)
      .set('Cookie', sessionCookie(1));
    expect(logout.status).toBe(200);
    expect(logout.headers['set-cookie'][0]).toContain('Max-Age=0');
    const revokedSession = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', sessionCookie(1));
    expect(revokedSession.status).toBe(401);
  });

  it('accepts only PaaS app hostnames for domain metadata', async () => {
    const { app, env } = createTestApp();
    const registered = await request(app)
      .post('/api/v1/auth/register')
      .set('Origin', env.APP_ORIGIN)
      .send({ email: 'owner@example.test', password: 'secure-password' });
    const application = await request(app)
      .post('/api/v1/applications')
      .set('Origin', env.APP_ORIGIN)
      .set('Cookie', sessionCookie(1))
      .send({
        name: 'demo',
        sourceRepository: 'https://github.com/ogulix/demo.git',
        defaultBranch: 'main',
      });

    expect(registered.status).toBe(201);
    const validDomain = await request(app)
      .post(`/api/v1/applications/${application.body.data.id}/domains`)
      .set('Origin', env.APP_ORIGIN)
      .set('Cookie', sessionCookie(1))
      .send({ hostname: 'demo.apps.ogulix.tech' });
    expect(validDomain.status).toBe(201);

    const invalidDomain = await request(app)
      .post(`/api/v1/applications/${application.body.data.id}/domains`)
      .set('Origin', env.APP_ORIGIN)
      .set('Cookie', sessionCookie(1))
      .send({ hostname: 'example.com' });
    expect(invalidDomain.status).toBe(400);
    expect(invalidDomain.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('supports deployments, encrypted env variables, nodes, and archive guards', async () => {
    const { app, env, enqueued } = createTestApp();
    await request(app)
      .post('/api/v1/auth/register')
      .set('Origin', env.APP_ORIGIN)
      .send({ email: 'owner@example.test', password: 'secure-password' });

    const createdApp = await request(app)
      .post('/api/v1/applications')
      .set('Origin', env.APP_ORIGIN)
      .set('Cookie', sessionCookie(1))
      .send({
        name: 'demo',
        sourceRepository: 'https://github.com/ogulix/demo.git',
        defaultBranch: 'main',
      });
    const appId = createdApp.body.data.id as string;

    const deployed = await request(app)
      .post(`/api/v1/applications/${appId}/deployments`)
      .set('Origin', env.APP_ORIGIN)
      .set('Cookie', sessionCookie(1))
      .set('Idempotency-Key', 'deploy-key-0001')
      .send({});
    expect(deployed.status).toBe(202);
    expect(enqueued).toHaveLength(1);

    const archiveBlocked = await request(app)
      .delete(`/api/v1/applications/${appId}`)
      .set('Origin', env.APP_ORIGIN)
      .set('Cookie', sessionCookie(1));
    expect(archiveBlocked.status).toBe(409);
    expect(archiveBlocked.body.error.code).toBe('INVALID_STATE');

    const putEnv = await request(app)
      .put(`/api/v1/applications/${appId}/env/API_SECRET`)
      .set('Origin', env.APP_ORIGIN)
      .set('Cookie', sessionCookie(1))
      .send({ value: 'top-secret-value', isSecret: true });
    expect(putEnv.status).toBe(200);
    expect(JSON.stringify(putEnv.body)).not.toContain('top-secret-value');

    const nodes = await request(app).get('/api/v1/nodes').set('Cookie', sessionCookie(1));
    expect(nodes.status).toBe(200);
    expect(nodes.body.data[0].name).toBe('mock-node-1');
    expect(nodes.body.data[0].host).toBeUndefined();
  });
});
