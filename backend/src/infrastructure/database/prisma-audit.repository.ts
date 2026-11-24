import type { PrismaClient } from '@prisma/client';
import type { AuditEventInput, AuditLogger } from '../../common/audit/audit-logger';

export class PrismaAuditRepository implements AuditLogger {
  constructor(private readonly prisma: PrismaClient) {}

  async record(event: AuditEventInput): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        actorUserId: event.actorUserId,
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId ?? null,
        requestId: event.requestId,
      },
    });
  }
}
