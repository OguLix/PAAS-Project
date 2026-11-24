import type { DomainResponse, CreateDomainInput } from '@ogulix/shared';
import type { ApplicationActor } from '../applications/application.repository';
import type { ApplicationService } from '../applications/application.service';
import { noopAuditLogger, type AuditLogger } from '../../common/audit/audit-logger';
import { notFound } from '../../common/errors/http-error';
import type { DomainRepository } from './domain.repository';

export class DomainService {
  constructor(
    private readonly repository: DomainRepository,
    private readonly applications: ApplicationService,
    private readonly audit: AuditLogger = noopAuditLogger,
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
    requestId = 'unknown',
  ): Promise<DomainResponse> {
    await this.applications.assertCanAccess(actor, applicationId);
    const created = await this.repository.create(applicationId, input);
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'domain.create',
      resourceType: 'DOMAIN',
      resourceId: created.id,
      requestId,
    });
    return this.toResponse(created);
  }

  async disable(
    actor: ApplicationActor,
    domainId: string,
    requestId = 'unknown',
  ): Promise<DomainResponse> {
    const domain = await this.repository.findById(domainId);
    if (!domain) {
      throw notFound('Domain not found');
    }

    await this.applications.assertCanAccess(actor, domain.applicationId);
    const disabled = await this.repository.disable(domainId);
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'domain.disable',
      resourceType: 'DOMAIN',
      resourceId: domainId,
      requestId,
    });
    return this.toResponse(disabled);
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
