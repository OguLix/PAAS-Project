import { ApiClientError } from '@/lib/api-client';
import type { ApiErrorCode } from '@ogulix/shared';
import type { AuthApi, AuthUser, MeResponse } from '../auth.types';

/**
 * In-memory stand-in for the `/auth/*` endpoints.
 *
 * This is an explicit test fixture, not a runtime mode. Production code never
 * imports it: `services/auth.api.ts` always talks to the Express API, so the
 * dashboard cannot silently fall back to simulated authentication. Import
 * `mockAuthApi` directly from a test when a deterministic auth double is
 * needed.
 *
 * Nothing here is persisted and nothing is shared between browser tabs.
 */

const DEMO_EMAIL = 'demo@ogulix.test';
const DEMO_PASSWORD = 'ogulix-demo-1';

/**
 * The real API returns 403 while REGISTRATION_MODE=closed, which is the default.
 * Flip this to true only to explore the registration success path in a test.
 */
const REGISTRATION_OPEN = false;

const users = new Map<string, { password: string; user: AuthUser }>();
let sessionUser: AuthUser | null = null;

function delay(ms = 300): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function fail(code: ApiErrorCode, message: string, status: number): never {
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
