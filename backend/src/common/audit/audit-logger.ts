export type AuditEventInput = {
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  requestId: string;
};

export interface AuditLogger {
  record(event: AuditEventInput): Promise<void>;
}

export const noopAuditLogger: AuditLogger = {
  async record() {},
};
