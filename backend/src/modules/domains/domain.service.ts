import type { DomainResponse, CreateDomainInput } from '@ogulix/shared';
import type { ApplicationActor } from '../applications/application.repository';
import type { ApplicationService } from '../applications/application.service';
import { notFound } from '../../common/errors/http-error';
import type { DomainRepository } from './domain.repository';

export class DomainService {
  constructor(
    private readonly repository: DomainRepository,
    private readonly applications: ApplicationService,
  ) {}

  async list(actor: ApplicationActor, applicationId: string): Promise<DomainResponse[]> {
    await this.applications.assertCanAccess(actor, applicationId);
    const domains = await this.repository.list(applicationId);
    return domains.map((domain) => this.toResponse(domain));
  }

  async create(
    actor: ApplicationActor,
    applicationId: string,
    input: CreateDomainInput,
  ): Promise<DomainResponse> {
    await this.applications.assertCanAccess(actor, applicationId);
    return this.toResponse(await this.repository.create(applicationId, input));
  }

  async disable(actor: ApplicationActor, domainId: string): Promise<DomainResponse> {
    const domain = await this.repository.findById(domainId);
    if (!domain) {
      throw notFound('Domain not found');
    }

    await this.applications.assertCanAccess(actor, domain.applicationId);
    return this.toResponse(await this.repository.disable(domainId));
  }

  private toResponse(
    domain: Awaited<ReturnType<DomainRepository['list']>>[number],
  ): DomainResponse {
    return {
      id: domain.id,
      applicationId: domain.applicationId,
      hostname: domain.hostname,
      isPrimary: domain.isPrimary,
      status: domain.status,
      createdAt: domain.createdAt.toISOString(),
    };
  }
}
