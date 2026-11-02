import { apiRequest } from '@/lib/api-client';
import type { DeploymentResponse } from './deployments.types';

export const deploymentsApi = {
  async get(deploymentId: string): Promise<DeploymentResponse> {
    const response = await apiRequest<DeploymentResponse>(
      `/deployments/${encodeURIComponent(deploymentId)}`,
    );
    return response.data;
  },
};
