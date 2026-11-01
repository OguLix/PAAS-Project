import type { CreateDomainInput, DomainResponse } from '@ogulix/shared';

export type DomainRecord = Omit<DomainResponse, 'createdAt'> & {
  createdAt: Date;
};

export interface DomainRepository {
  list(applicationId: string): Promise<DomainRecord[]>;
  create(applicationId: string, input: CreateDomainInput): Promise<DomainRecord>;
  findById(domainId: string): Promise<DomainRecord | null>;
  disable(domainId: string): Promise<DomainRecord>;
}
