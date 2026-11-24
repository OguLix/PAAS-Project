import type { EnvironmentVariableInput, EnvironmentVariableSummary } from '@ogulix/shared';
import { encryptSecret } from '@ogulix/shared/server/crypto';
import type { AppEnv } from '../../config/env';
import type { ApplicationActor } from '../applications/application.repository';
import type { ApplicationService } from '../applications/application.service';
import { noopAuditLogger, type AuditLogger } from '../../common/audit/audit-logger';
import { notFound, serviceUnavailable } from '../../common/errors/http-error';
import type { EnvironmentVariableRecord, EnvironmentVariableRepository } from './env.repository';

export class EnvironmentVariableService {
  constructor(
    private readonly repository: EnvironmentVariableRepository,
    private readonly applications: ApplicationService,
    private readonly env: Pick<AppEnv, 'ENV_ENCRYPTION_KEY'>,
    private readonly audit: AuditLogger = noopAuditLogger,
  ) {}

  async list(
    actor: ApplicationActor,
    applicationId: string,
  ): Promise<EnvironmentVariableSummary[]> {
    await this.applications.assertCanAccess(actor, applicationId);
    const records = await this.repository.listByApplication(applicationId);
    return records.map((record) => this.toSummary(record));
  }

  async upsert(
    actor: ApplicationActor,
    applicationId: string,
    key: string,
    input: EnvironmentVariableInput,
    requestId: string,
  ): Promise<EnvironmentVariableSummary> {
    await this.applications.assertCanAccess(actor, applicationId);
    if (!this.env.ENV_ENCRYPTION_KEY) {
      throw serviceUnavailable('Environment variable encryption is not configured');
    }

    const encryptedValue = encryptSecret(input.value, this.env.ENV_ENCRYPTION_KEY);
    const record = await this.repository.upsert(applicationId, key, encryptedValue, input.isSecret);

    await this.audit.record({
      actorUserId: actor.userId,
      action: 'env.upsert',
      resourceType: 'ENVIRONMENT_VARIABLE',
      resourceId: `${applicationId}:${key}`,
      requestId,
    });

    return this.toSummary(record);
  }

  async remove(
    actor: ApplicationActor,
    applicationId: string,
    key: string,
    requestId: string,
  ): Promise<{ key: string; deleted: true }> {
    await this.applications.assertCanAccess(actor, applicationId);
    const deleted = await this.repository.deleteByKey(applicationId, key);
    if (!deleted) {
      throw notFound('Environment variable not found');
    }

    await this.audit.record({
      actorUserId: actor.userId,
      action: 'env.delete',
      resourceType: 'ENVIRONMENT_VARIABLE',
      resourceId: `${applicationId}:${key}`,
      requestId,
    });

    return { key, deleted: true };
  }

  private toSummary(record: EnvironmentVariableRecord): EnvironmentVariableSummary {
    return {
      key: record.key,
      isSecret: record.isSecret,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
