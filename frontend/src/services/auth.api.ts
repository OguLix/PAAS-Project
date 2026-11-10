import { apiRequest } from '@/lib/api-client';
import type { AuthApi, LoginInput, MeResponse, RegisterInput } from './auth.types';

/**
 * The only place a screen may call authentication.
 *
 * The real API is always used. There is no mock fallback: when the backend is
 * unreachable the call fails and the UI reports a connection error instead of
 * silently serving simulated data. `services/mock/auth.mock.ts` still exists as
 * an explicit fixture for tests, and it is never imported from production code.
 */
export const authApi: AuthApi = {
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
