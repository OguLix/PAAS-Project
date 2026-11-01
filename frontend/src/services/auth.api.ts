import { apiRequest } from '@/lib/api-client';
import type { AuthApi, LoginInput, MeResponse, RegisterInput } from './auth.types';
import { isMockEnabled, mockAuthApi } from './mock/auth.mock';

/**
 * The only place a screen may call authentication. Swapping the mock for the
 * real API happens here and nowhere else.
 */
const realAuthApi: AuthApi = {
  async me(): Promise<MeResponse> {
    const response = await apiRequest<MeResponse>('/auth/me');
    return response.data;
  },

  async login(input: LoginInput): Promise<MeResponse> {
    const response = await apiRequest<MeResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });

    return response.data;
  },

  async register(input: RegisterInput): Promise<MeResponse> {
    const response = await apiRequest<MeResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });

    return response.data;
  },

  async logout(): Promise<void> {
    await apiRequest<Record<string, never>>('/auth/logout', { method: 'POST' });
  },
};

export const authApi: AuthApi = isMockEnabled() ? mockAuthApi : realAuthApi;
