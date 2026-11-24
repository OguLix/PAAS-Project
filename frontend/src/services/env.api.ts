import type { EnvironmentVariableInput, EnvironmentVariableSummary } from '@ogulix/shared';
import { apiRequest } from '@/lib/api-client';

export const envApi = {
  async list(applicationId: string): Promise<EnvironmentVariableSummary[]> {
    const response = await apiRequest<EnvironmentVariableSummary[]>(
      `/applications/${encodeURIComponent(applicationId)}/env`,
    );
    return response.data;
  },

  async upsert(
    applicationId: string,
    key: string,
    input: EnvironmentVariableInput,
  ): Promise<EnvironmentVariableSummary> {
    const response = await apiRequest<EnvironmentVariableSummary>(
      `/applications/${encodeURIComponent(applicationId)}/env/${encodeURIComponent(key)}`,
      {
        method: 'PUT',
        body: JSON.stringify(input),
      },
    );
    return response.data;
  },

  async remove(applicationId: string, key: string): Promise<void> {
    await apiRequest<{ key: string; deleted: true }>(
      `/applications/${encodeURIComponent(applicationId)}/env/${encodeURIComponent(key)}`,
      { method: 'DELETE' },
    );
  },
};
