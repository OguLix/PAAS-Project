import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { AuthUser } from '@ogulix/shared';
import { loadEnv } from '../src/config/env';
import type {
  AuthRepository,
  AuthUserRecord,
  NewSession,
  SessionRecord,
} from '../src/modules/auth/auth.repository';
import { AuthService } from '../src/modules/auth/auth.service';

class InMemoryAuthRepository implements AuthRepository {
  readonly users = new Map<string, AuthUserRecord>();
  readonly sessions = new Map<string, SessionRecord>();
  readonly auditActions: string[] = [];

  async findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    return [...this.users.values()].find((user) => user.email === email) ?? null;
  }

  async createUser(email: string, passwordHash: string): Promise<AuthUser> {
    const user = { id: `user-${this.users.size + 1}`, email, role: 'USER' as const, passwordHash };
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
      userId: session.userId,
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
    const entry = [...this.sessions.entries()].find(([, session]) => session.id === sessionId);
    if (
      !entry ||
      entry[1].revokedAt ||
      entry[1].expiresAt <= now ||
      entry[1].lastSeenAt <= idleCutoff
    ) {
      return false;
    }

    entry[1].lastSeenAt = now;
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
    action: string,
    _requestId: string,
  ): Promise<void> {
    this.auditActions.push(action);
  }
}

const passwordHasher = {
  hash: async (value: string) => `hashed:${value}`,
  verify: async (hash: string, value: string) => hash === `hashed:${value}`,
};

function createService(
  repository: InMemoryAuthRepository,
  options: { registrationMode?: 'open' | 'closed'; now?: () => Date } = {},
): AuthService {
  let tokenId = 0;
  return new AuthService(
    repository,
    loadEnv({
      NODE_ENV: 'test',
      REGISTRATION_MODE: options.registrationMode ?? 'open',
      SESSION_TTL_HOURS: '168',
      SESSION_IDLE_HOURS: '24',
    }),
    {
      passwordHasher,
      createToken: () => `${String(++tokenId).padStart(43, 'a')}`.slice(-43),
      now: options.now,
    },
  );
}

describe('AuthService', () => {
  it('stores only a SHA-256 token hash and returns the safe user DTO', async () => {
    const repository = new InMemoryAuthRepository();
    const service = createService(repository);

    const session = await service.register(
      { email: 'person@example.test', password: 'secure-password' },
      'request-1',
    );

    expect(session.user).toEqual({
      id: 'user-1',
      email: 'person@example.test',
      role: 'USER',
    });
    expect(session.token).toHaveLength(43);
    expect(repository.sessions.has(session.token)).toBe(false);
    expect(repository.sessions.has(createHash('sha256').update(session.token).digest('hex'))).toBe(
      true,
    );
    expect(repository.auditActions).toContain('auth.register');
  });

  it('does not permit registration while registration mode is closed', async () => {
    const repository = new InMemoryAuthRepository();
    const service = createService(repository, { registrationMode: 'closed' });

    await expect(
      service.register({ email: 'person@example.test', password: 'secure-password' }, 'request-1'),
    ).rejects.toMatchObject({ status: 403, code: 'REGISTRATION_CLOSED' });
    expect(repository.users.size).toBe(0);
  });

  it('authenticates matching credentials and gives the same error for invalid credentials', async () => {
    const repository = new InMemoryAuthRepository();
    const service = createService(repository);
    await service.register(
      { email: 'person@example.test', password: 'secure-password' },
      'request-1',
    );

    const session = await service.login(
      { email: 'person@example.test', password: 'secure-password' },
      'request-2',
    );
    expect(session.user.email).toBe('person@example.test');
    await expect(
      service.login({ email: 'person@example.test', password: 'incorrect' }, 'request-3'),
    ).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHENTICATED',
      message: 'Email or password is incorrect',
    });
    await expect(
      service.login({ email: 'missing@example.test', password: 'incorrect' }, 'request-4'),
    ).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHENTICATED',
      message: 'Email or password is incorrect',
    });
  });

  it('rejects idle-expired and revoked sessions', async () => {
    const repository = new InMemoryAuthRepository();
    let now = new Date('2026-11-01T00:00:00.000Z');
    const service = createService(repository, { now: () => now });
    const session = await service.register(
      { email: 'person@example.test', password: 'secure-password' },
      'request-1',
    );

    now = new Date(now.getTime() + 25 * 60 * 60 * 1000);
    await expect(service.authenticate(session.token)).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHENTICATED',
    });

    now = new Date('2026-11-01T01:00:00.000Z');
    await service.logout(session.token, 'request-2');
    await expect(service.authenticate(session.token)).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHENTICATED',
    });
  });

  it('renews activity without extending the absolute session expiry', async () => {
    const repository = new InMemoryAuthRepository();
    const createdAt = new Date('2026-11-01T00:00:00.000Z');
    let now = createdAt;
    const service = createService(repository, { now: () => now });
    const session = await service.register(
      { email: 'person@example.test', password: 'secure-password' },
      'request-1',
    );

    now = new Date(createdAt.getTime() + 23 * 60 * 60 * 1000);
    await expect(service.authenticate(session.token)).resolves.toMatchObject({
      userId: 'user-1',
    });
    now = new Date(createdAt.getTime() + 46 * 60 * 60 * 1000);
    await expect(service.authenticate(session.token)).resolves.toMatchObject({
      userId: 'user-1',
    });

    now = new Date(createdAt.getTime() + 8 * 24 * 60 * 60 * 1000);
    await expect(service.authenticate(session.token)).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHENTICATED',
    });
  });
});
