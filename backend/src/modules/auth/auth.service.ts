import { createHash, randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import type { AuthUser } from '@ogulix/shared';
import type { AppEnv } from '../../config/env';
import { HttpError } from '../../common/errors/http-error';
import type { AuthContext } from '../../common/auth/auth-context';
import type { AuthRepository, SessionRecord } from './auth.repository';

type PasswordHasher = {
  hash(value: string): Promise<string>;
  verify(hash: string, value: string): Promise<boolean>;
};

type AuthServiceOptions = {
  passwordHasher?: PasswordHasher;
  createToken?: () => string;
  now?: () => Date;
};

const argon2idHasher: PasswordHasher = {
  hash: (value) => argon2.hash(value, { type: argon2.argon2id }),
  verify: (hash, value) => argon2.verify(hash, value),
};

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function publicUser(user: AuthUser): AuthUser {
  return { id: user.id, email: user.email, role: user.role };
}

export type AuthSession = {
  user: AuthUser;
  token: string;
  expiresAt: Date;
};

export class AuthService {
  private readonly passwordHasher: PasswordHasher;
  private readonly createToken: () => string;
  private readonly now: () => Date;

  constructor(
    private readonly repository: AuthRepository,
    private readonly env: AppEnv,
    options: AuthServiceOptions = {},
  ) {
    this.passwordHasher = options.passwordHasher ?? argon2idHasher;
    this.createToken = options.createToken ?? (() => randomBytes(32).toString('base64url'));
    this.now = options.now ?? (() => new Date());
  }

  async register(
    input: { email: string; password: string },
    requestId: string,
  ): Promise<AuthSession> {
    if (this.env.REGISTRATION_MODE !== 'open') {
      throw new HttpError(403, 'REGISTRATION_CLOSED', 'Registration is currently closed');
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    const user = await this.repository.createUser(input.email, passwordHash);
    return this.issueSession(user, requestId, 'auth.register');
  }

  async login(input: { email: string; password: string }, requestId: string): Promise<AuthSession> {
    const user = await this.repository.findUserByEmail(input.email);
    if (!user) {
      await this.passwordHasher.hash(input.password);
      await this.repository.createAuthAuditEvent(null, 'auth.login.failed', requestId);
      throw new HttpError(401, 'UNAUTHENTICATED', 'Email or password is incorrect');
    }

    const passwordMatches = await this.passwordHasher.verify(user.passwordHash, input.password);
    if (!passwordMatches) {
      await this.repository.createAuthAuditEvent(user.id, 'auth.login.failed', requestId);
      throw new HttpError(401, 'UNAUTHENTICATED', 'Email or password is incorrect');
    }

    return this.issueSession(publicUser(user), requestId, 'auth.login');
  }

  async authenticate(token: string): Promise<AuthContext> {
    const now = this.now();
    const session = await this.repository.findSessionByTokenHash(hashToken(token));
    if (!this.isActive(session, now)) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Session is invalid or expired');
    }

    const idleCutoff = new Date(now.getTime() - this.env.SESSION_IDLE_HOURS * 60 * 60 * 1000);
    if (!(await this.repository.touchSession(session.id, now, idleCutoff))) {
      throw new HttpError(401, 'UNAUTHENTICATED', 'Session is invalid or expired');
    }

    return {
      userId: session.user.id,
      email: session.user.email,
      role: session.user.role,
      sessionId: session.id,
    };
  }

  async logout(token: string | null, requestId: string): Promise<void> {
    if (!token) {
      return;
    }

    const session = await this.repository.findSessionByTokenHash(hashToken(token));
    if (!session || session.revokedAt) {
      return;
    }

    const now = this.now();
    await this.repository.revokeSession(session.id, now);
    await this.repository.createAuthAuditEvent(session.userId, 'auth.logout', requestId);
  }

  private async issueSession(
    user: AuthUser,
    requestId: string,
    auditAction: string,
  ): Promise<AuthSession> {
    const now = this.now();
    const token = this.createToken();
    const expiresAt = new Date(now.getTime() + this.env.SESSION_TTL_HOURS * 60 * 60 * 1000);

    await this.repository.createSession({
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt,
      lastSeenAt: now,
    });
    await this.repository.createAuthAuditEvent(user.id, auditAction, requestId);

    return { user, token, expiresAt };
  }

  private isActive(session: SessionRecord | null, now: Date): session is SessionRecord {
    if (!session || session.revokedAt || session.expiresAt <= now) {
      return false;
    }

    const idleCutoff = now.getTime() - this.env.SESSION_IDLE_HOURS * 60 * 60 * 1000;
    return session.lastSeenAt.getTime() > idleCutoff;
  }
}
