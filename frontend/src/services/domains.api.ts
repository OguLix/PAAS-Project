import type { CreateDomainInput, DomainResponse } from '@ogulix/shared';
import { apiRequest } from '@/lib/api-client';

export const domainsApi = {
  async list(applicationId: string): Promise<DomainResponse[]> {
    const response = await apiRequest<DomainResponse[]>(
      `/applications/${encodeURIComponent(applicationId)}/domains`,
    );
    return response.data;
  },

  async create(applicationId: string, input: CreateDomainInput): Promise<DomainResponse> {
    const response = await apiRequest<DomainResponse>(
      `/applications/${encodeURIComponent(applicationId)}/domains`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    );
    return response.data;
  },

  async disable(domainId: string): Promise<DomainResponse> {
    const response = await apiRequest<DomainResponse>(`/domains/${encodeURIComponent(domainId)}`, {
      method: 'DELETE',
    });
    return response.data;
  },
};
