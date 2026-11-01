import { useSyncExternalStore } from 'react';
import { ApiClientError } from '@/lib/api-client';
import { messageForError } from '@/lib/errors';
import { authApi } from '@/services/auth.api';
import type { AuthUser } from '@/services/auth.types';

/**
 * Session state for the browser.
 *
 * The real session is the HttpOnly `ogulix_session` cookie, which JavaScript
 * cannot read. This store only mirrors what `GET /auth/me` reported, so nothing
 * secret is kept in memory, localStorage or sessionStorage.
 */

export type SessionStatus = 'loading' | 'authenticated' | 'anonymous' | 'error';

export type SessionSnapshot = {
  status: SessionStatus;
  user: AuthUser | null;
  error?: string;
};

let snapshot: SessionSnapshot = { status: 'loading', user: null };
const listeners = new Set<() => void>();

function publish(next: SessionSnapshot): void {
  snapshot = next;

  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): SessionSnapshot {
  return snapshot;
}

let hydration: Promise<void> | null = null;

async function loadSession(): Promise<void> {
  try {
    const { user } = await authApi.me();
    publish({ status: 'authenticated', user });
  } catch (error) {
    if (error instanceof ApiClientError && error.code === 'UNAUTHENTICATED') {
      publish({ status: 'anonymous', user: null });
      return;
    }

    if (error instanceof ApiClientError && error.code === 'FORBIDDEN') {
      publish({ status: 'anonymous', user: null });
      return;
    }

    // An unreachable API is not the same as being signed out, so the UI must
    // show a retryable error instead of bouncing the user to the login screen.
    publish({ status: 'error', user: null, error: messageForError(error) });
  }
}

/** Idempotent: the session is fetched once per page load unless reloaded. */
export function hydrateSession(): Promise<void> {
  hydration ??= loadSession();

  return hydration;
}

export function reloadSession(): Promise<void> {
  hydration = loadSession();

  return hydration;
}

export function setAuthenticated(user: AuthUser): void {
  hydration = Promise.resolve();
  publish({ status: 'authenticated', user });
}

export async function signOut(): Promise<void> {
  try {
    await authApi.logout();
  } finally {
    hydration = Promise.resolve();
    publish({ status: 'anonymous', user: null });
  }
}

export function useSession(): SessionSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Test helper. Not used by application code. */
export function resetSessionForTests(): void {
  hydration = null;
  snapshot = { status: 'loading', user: null };
}
