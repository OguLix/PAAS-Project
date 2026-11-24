import {
  DEFAULT_APPLICATION_CONFIG,
  type ApplicationResponse,
  type CreateApplicationInput,
  type UpdateApplicationInput,
} from '@ogulix/shared';
import type {
  ApplicationActor,
  ApplicationRecord,
  ApplicationRepository,
} from './application.repository';
import { noopAuditLogger, type AuditLogger } from '../../common/audit/audit-logger';
import { invalidState, notFound } from '../../common/errors/http-error';

export class ApplicationService {
  constructor(
    private readonly repository: ApplicationRepository,
    private readonly audit: AuditLogger = noopAuditLogger,
  ) {}

  async list(
    actor: ApplicationActor,
    page: number,
    pageSize: number,
  ): Promise<{ applications: ApplicationResponse[]; total: number }> {
    const ownerId = actor.role === 'ADMIN' ? undefined : actor.userId;
    const [records, total] = await Promise.all([
      this.repository.list({ ownerId, skip: (page - 1) * pageSize, take: pageSize }),
      this.repository.count(ownerId),
    ]);

    return { applications: records.map((record) => this.toResponse(record)), total };
  }

  async get(actor: ApplicationActor, applicationId: string): Promise<ApplicationResponse> {
    const application = await this.repository.findActiveById(applicationId);
    this.assertAccessible(actor, application);
    return this.toResponse(application);
  }

  async create(
    actor: ApplicationActor,
    input: CreateApplicationInput,
    requestId = 'unknown',
  ): Promise<ApplicationResponse> {
    const application = await this.repository.create(actor.userId, {
      ...DEFAULT_APPLICATION_CONFIG,
      ...input,
    });
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'application.create',
      resourceType: 'APPLICATION',
      resourceId: application.id,
      requestId,
    });
    return this.toResponse(application);
  }

  async update(
    actor: ApplicationActor,
    applicationId: string,
    input: UpdateApplicationInput,
    requestId = 'unknown',
  ): Promise<ApplicationResponse> {
    const application = await this.repository.findActiveById(applicationId);
    this.assertAccessible(actor, application);
    const updated = await this.repository.update(applicationId, input);
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'application.update',
      resourceType: 'APPLICATION',
      resourceId: applicationId,
      requestId,
    });
    return this.toResponse(updated);
  }

  async archive(
    actor: ApplicationActor,
    applicationId: string,
    requestId = 'unknown',
  ): Promise<ApplicationResponse> {
    const application = await this.repository.findActiveById(applicationId);
    this.assertAccessible(actor, application);
    if (await this.repository.hasActiveDeployments(applicationId)) {
      throw invalidState(
        'Cannot archive an application with an active deployment; stop or cancel it first',
      );
    }

    const archived = await this.repository.archive(applicationId);
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'application.archive',
      resourceType: 'APPLICATION',
      resourceId: applicationId,
      requestId,
    });
    return this.toResponse(archived);
  }

  async assertCanAccess(
    actor: ApplicationActor,
    applicationId: string,
  ): Promise<ApplicationRecord> {
    const application = await this.repository.findActiveById(applicationId);
    this.assertAccessible(actor, application);
    return application;
  }

  private assertAccessible(
    actor: ApplicationActor,
    application: ApplicationRecord | null,
  ): asserts application is ApplicationRecord {
    if (!application || (actor.role !== 'ADMIN' && application.ownerId !== actor.userId)) {
      throw notFound('Application not found');
    }
  }

  private toResponse(application: ApplicationRecord): ApplicationResponse {
    const { ownerId: _ownerId, ...response } = application;
    return {
      ...response,
      createdAt: application.createdAt.toISOString(),
      updatedAt: application.updatedAt.toISOString(),
    };
  }
}
