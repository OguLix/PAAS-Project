import { apiRequest } from '@/lib/api-client';
import type { DeploymentLogEntry, DeploymentResponse } from './deployments.types';

const deploymentPath = (deploymentId: string) => `/deployments/${encodeURIComponent(deploymentId)}`;

export const deploymentsApi = {
  async get(deploymentId: string): Promise<DeploymentResponse> {
    const response = await apiRequest<DeploymentResponse>(deploymentPath(deploymentId));
    return response.data;
  },

  async logs(deploymentId: string, after?: number): Promise<DeploymentLogEntry[]> {
    const query = new URLSearchParams({ limit: '100' });
    if (after !== undefined) {
      query.set('after', String(after));
    }
    const response = await apiRequest<DeploymentLogEntry[]>(
      `${deploymentPath(deploymentId)}/logs?${query.toString()}`,
    );
    return response.data;
  },

  async cancel(deploymentId: string): Promise<DeploymentResponse> {
    const response = await apiRequest<DeploymentResponse>(
      `${deploymentPath(deploymentId)}/cancel`,
      { method: 'POST' },
    );
    return response.data;
  },

  async stop(deploymentId: string): Promise<DeploymentResponse> {
    const response = await apiRequest<DeploymentResponse>(`${deploymentPath(deploymentId)}/stop`, {
      method: 'POST',
    });
    return response.data;
  },

  async restart(deploymentId: string): Promise<DeploymentResponse> {
    const response = await apiRequest<DeploymentResponse>(
      `${deploymentPath(deploymentId)}/restart`,
      { method: 'POST' },
    );
    return response.data;
  },
};
