import { describe, expect, it } from 'vitest';
import request from 'supertest';
import type {
  ApplicationResponse,
  CreateApplicationInput,
  CreateDomainInput,
  UpdateApplicationInput,
  AuthUser,
} from '@ogulix/shared';
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
import type { DomainRecord, DomainRepository } from '../src/modules/domains/domain.repository';
import { DomainService } from '../src/modules/domains/domain.service';

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

class ApiApplicationRepository implements ApplicationRepository {
  private readonly records = new Map<string, ApplicationRecord>();

  async list(query: ApplicationListQuery): Promise<ApplicationResponse[]> {
    return [...this.records.values()]
      .filter(
        (application) =>
          application.status === 'ACTIVE' &&
          (!query.ownerId || application.ownerId === query.ownerId),
      )
      .slice(query.skip, query.skip + query.take)
      .map((application) => this.toResponse(application));
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

  async create(ownerId: string, input: CreateApplicationInput): Promise<ApplicationRecord> {
    const now = new Date();
    const application: ApplicationRecord = {
      id: `app-${this.records.size + 1}`,
      ownerId,
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

  private toResponse(application: ApplicationRecord): ApplicationResponse {
    return {
      id: application.id,
      name: application.name,
      sourceRepository: application.sourceRepository,
      defaultBranch: application.defaultBranch,
      status: application.status,
      currentDeploymentId: application.currentDeploymentId,
      createdAt: application.createdAt.toISOString(),
      updatedAt: application.updatedAt.toISOString(),
    };
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

function createTestApp(): { app: ReturnType<typeof createApp>; env: AppEnv } {
  const env = loadEnv({
    NODE_ENV: 'test',
    REGISTRATION_MODE: 'open',
    REDIS_URL: 'redis://127.0.0.1:6379',
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
  const applicationRepository = new ApiApplicationRepository();
  const applicationService = new ApplicationService(applicationRepository);
  const domainService = new DomainService(new ApiDomainRepository(), applicationService);
  return {
    env,
    app: createApp(env, {
      authService,
      applicationService,
      domainService,
      checkDatabase: async () => {},
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
});
