import type {
  ApplicationResponse,
  CreateApplicationInput,
  UpdateApplicationInput,
} from '@ogulix/shared';
import { apiRequest } from '@/lib/api-client';
import type { DeploymentLogEntry, DeploymentResponse } from './deployments.types';

const applicationPath = (applicationId: string) =>
  `/applications/${encodeURIComponent(applicationId)}`;

export const applicationsApi = {
  async list(
    page: number,
    pageSize = 20,
  ): Promise<{ applications: ApplicationResponse[]; total: number }> {
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    const response = await apiRequest<ApplicationResponse[]>(`/applications?${query.toString()}`);
    if (!response.meta.pagination) {
      throw new Error('The API response did not include application pagination metadata.');
    }
    return { applications: response.data, total: response.meta.pagination.total };
  },

  async get(applicationId: string): Promise<ApplicationResponse> {
    const response = await apiRequest<ApplicationResponse>(applicationPath(applicationId));
    return response.data;
  },

  async create(input: CreateApplicationInput): Promise<ApplicationResponse> {
    const response = await apiRequest<ApplicationResponse>('/applications', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return response.data;
  },

  async update(applicationId: string, input: UpdateApplicationInput): Promise<ApplicationResponse> {
    const response = await apiRequest<ApplicationResponse>(applicationPath(applicationId), {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    return response.data;
  },

  async archive(applicationId: string): Promise<ApplicationResponse> {
    const response = await apiRequest<ApplicationResponse>(applicationPath(applicationId), {
      method: 'DELETE',
    });
    return response.data;
  },

  async deployments(applicationId: string): Promise<DeploymentResponse[]> {
    const response = await apiRequest<DeploymentResponse[]>(
      `${applicationPath(applicationId)}/deployments`,
    );
    return response.data;
  },

  async deploy(
    applicationId: string,
    input: { branch?: string; commitSha?: string },
  ): Promise<DeploymentResponse> {
    const headers = new Headers({ 'Idempotency-Key': crypto.randomUUID() });
    const response = await apiRequest<DeploymentResponse>(
      `${applicationPath(applicationId)}/deployments`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
      },
    );
    return response.data;
  },

  async logs(applicationId: string, after?: number): Promise<DeploymentLogEntry[]> {
    const query = new URLSearchParams({ limit: '200' });
    if (after !== undefined) {
      query.set('after', String(after));
    }
    const response = await apiRequest<DeploymentLogEntry[]>(
      `${applicationPath(applicationId)}/logs?${query.toString()}`,
    );
    return response.data;
  },
};
