import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import type { AuthUser } from '@ogulix/shared';
import { conflict } from '../../common/errors/http-error';
import type {
  AuthRepository,
  AuthUserRecord,
  NewSession,
  SessionRecord,
} from '../../modules/auth/auth.repository';

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true, role: true },
    });
  }

  async createUser(email: string, passwordHash: string): Promise<AuthUser> {
    try {
      return await this.prisma.user.create({
        data: { email, passwordHash },
        select: { id: true, email: true, role: true },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw conflict('An account with this email already exists');
      }
      throw error;
    }
  }

  async createSession(session: NewSession): Promise<{ id: string }> {
    return this.prisma.session.create({
      data: session,
      select: { id: true },
    });
  }

  async findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    return this.prisma.session.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        lastSeenAt: true,
        revokedAt: true,
        user: { select: { id: true, email: true, role: true } },
      },
    });
  }

  async touchSession(sessionId: string, now: Date, idleCutoff: Date): Promise<boolean> {
    const updated = await this.prisma.session.updateMany({
      where: {
        id: sessionId,
        revokedAt: null,
        expiresAt: { gt: now },
        lastSeenAt: { gt: idleCutoff },
      },
      data: { lastSeenAt: now },
    });
    return updated.count === 1;
  }

  async revokeSession(sessionId: string, revokedAt: Date): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt },
    });
  }

  async createAuthAuditEvent(
    actorUserId: string | null,
    action: string,
    requestId: string,
  ): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        actorUserId,
        action,
        resourceType: 'SESSION',
        requestId,
      },
    });
  }
}
