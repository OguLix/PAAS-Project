import { ApiClientError } from '@/lib/api-client';
import type { AuthApi, AuthUser, MeResponse } from '../auth.types';

/**
 * In-memory stand-in for the `/auth/*` endpoints.
 *
 * It exists only because those endpoints are not implemented yet. Every screen
 * calls `services/auth.api.ts`, so deleting this file and the
 * `NEXT_PUBLIC_USE_MOCKS` branch removes the mock completely.
 *
 * Nothing here is persisted and nothing is shared between browser tabs.
 */

const DEMO_EMAIL = 'demo@ogulix.test';
const DEMO_PASSWORD = 'ogulix-demo-1';

/**
 * The real API returns 403 while REGISTRATION_MODE=closed, which is the default.
 * Flip this to true only to explore the registration success path locally.
 */
const REGISTRATION_OPEN = false;

const users = new Map<string, { password: string; user: AuthUser }>();
let sessionUser: AuthUser | null = null;

function delay(ms = 300): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function fail(code: ApiClientError['code'], message: string, status: number): never {
  throw new ApiClientError(message, code, status, 'mock');
}

function seedDemoUser(): void {
  if (users.size > 0) {
    return;
  }

  users.set(DEMO_EMAIL, {
    password: DEMO_PASSWORD,
    user: { id: 'mock-user-1', email: DEMO_EMAIL, role: 'USER' },
  });
}

export function isMockEnabled(): boolean {  
    return false;

  // Unset: on for local development, always off for a production build.
  return process.env.NODE_ENV !== 'production';
}

export const mockAuthApi: AuthApi = {
  async me(): Promise<MeResponse> {
    await delay(120);

    if (!sessionUser) {
      fail('UNAUTHENTICATED', 'No active session.', 401);
    }

    return { user: sessionUser };
  },

  async login(input): Promise<MeResponse> {
    await delay();
    seedDemoUser();

    const email = input.email.trim().toLowerCase();
    const record = users.get(email);

    if (!record || record.password !== input.password) {
      fail('UNAUTHENTICATED', 'Email or password is incorrect.', 401);
    }

    sessionUser = record.user;

    return { user: record.user };
  },

  async register(input): Promise<MeResponse> {
    await delay();
    seedDemoUser();

    if (!REGISTRATION_OPEN) {
      fail('REGISTRATION_CLOSED', 'Registration is closed.', 403);
    }

    const email = input.email.trim().toLowerCase();

    if (users.has(email)) {
      fail('CONFLICT', 'An account with this email already exists.', 409);
    }

    const user: AuthUser = { id: `mock-user-${users.size + 1}`, email, role: 'USER' };
    users.set(email, { password: input.password, user });
    sessionUser = user;

    return { user };
  },

  async logout(): Promise<void> {
    await delay(120);
    sessionUser = null;
  },
};
