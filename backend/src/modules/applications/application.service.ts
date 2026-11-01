import type {
  ApplicationResponse,
  CreateApplicationInput,
  UpdateApplicationInput,
} from '@ogulix/shared';
import type {
  ApplicationActor,
  ApplicationRecord,
  ApplicationRepository,
} from './application.repository';
import { notFound } from '../../common/errors/http-error';

export class ApplicationService {
  constructor(private readonly repository: ApplicationRepository) {}

  async list(
    actor: ApplicationActor,
    page: number,
    pageSize: number,
  ): Promise<{ applications: ApplicationResponse[]; total: number }> {
    const ownerId = actor.role === 'ADMIN' ? undefined : actor.userId;
    const [applications, total] = await Promise.all([
      this.repository.list({ ownerId, skip: (page - 1) * pageSize, take: pageSize }),
      this.repository.count(ownerId),
    ]);

    return { applications, total };
  }

  async get(actor: ApplicationActor, applicationId: string): Promise<ApplicationResponse> {
    const application = await this.repository.findActiveById(applicationId);
    this.assertAccessible(actor, application);
    return this.toResponse(application);
  }

  async create(
    actor: ApplicationActor,
    input: CreateApplicationInput,
  ): Promise<ApplicationResponse> {
    const application = await this.repository.create(actor.userId, input);
    return this.toResponse(application);
  }

  async update(
    actor: ApplicationActor,
    applicationId: string,
    input: UpdateApplicationInput,
  ): Promise<ApplicationResponse> {
    const application = await this.repository.findActiveById(applicationId);
    this.assertAccessible(actor, application);
    return this.toResponse(await this.repository.update(applicationId, input));
  }

  async archive(actor: ApplicationActor, applicationId: string): Promise<ApplicationResponse> {
    const application = await this.repository.findActiveById(applicationId);
    this.assertAccessible(actor, application);
    return this.toResponse(await this.repository.archive(applicationId));
  }

  async assertCanAccess(actor: ApplicationActor, applicationId: string): Promise<void> {
    const application = await this.repository.findActiveById(applicationId);
    this.assertAccessible(actor, application);
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
