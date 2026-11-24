import type { RuntimeNodeResponse } from '@ogulix/shared';
import { apiRequest } from '@/lib/api-client';

export const nodesApi = {
  async list(): Promise<RuntimeNodeResponse[]> {
    const response = await apiRequest<RuntimeNodeResponse[]>('/nodes');
    return response.data;
  },
};
