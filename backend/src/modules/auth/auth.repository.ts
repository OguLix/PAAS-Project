import type { AuthUser } from '@ogulix/shared';

export type AuthUserRecord = AuthUser & { passwordHash: string };

export type SessionRecord = {
  id: string;
  userId: string;
  expiresAt: Date;
  lastSeenAt: Date;
  revokedAt: Date | null;
  user: AuthUser;
};

export type NewSession = {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  lastSeenAt: Date;
};

export interface AuthRepository {
  findUserByEmail(email: string): Promise<AuthUserRecord | null>;
  createUser(email: string, passwordHash: string): Promise<AuthUser>;
  createSession(session: NewSession): Promise<{ id: string }>;
  findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  touchSession(sessionId: string, now: Date, idleCutoff: Date): Promise<boolean>;
  revokeSession(sessionId: string, revokedAt: Date): Promise<void>;
  createAuthAuditEvent(
    actorUserId: string | null,
    action: string,
    requestId: string,
  ): Promise<void>;
}
