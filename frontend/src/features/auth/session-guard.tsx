'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ErrorState } from '@/components/feedback/error-state';
import { LoadingState } from '@/components/feedback/loading-state';
import { hydrateSession, reloadSession, useSession } from './session-store';

/**
 * Client-side convenience guard. It keeps anonymous visitors out of the
 * dashboard, but it is not the security boundary: every protected operation is
 * authorized again by the API (api-contract.md section 1).
 */
export function SessionGuard({ children }: { children: ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    void hydrateSession();
  }, []);

  useEffect(() => {
    if (session.status === 'anonymous') {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [session.status, router, pathname]);

  if (session.status === 'loading') {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <LoadingState label="Checking your session" />
      </main>
    );
  }

  if (session.status === 'error') {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <ErrorState
          title="Cannot check your session"
          message={session.error ?? 'The session could not be verified.'}
          onRetry={() => {
            void reloadSession();
          }}
        />
      </main>
    );
  }

  if (session.status === 'anonymous') {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <LoadingState label="Opening the sign in page" />
      </main>
    );
  }

  return <>{children}</>;
}
