import { isMockEnabled } from '@/services/mock/auth.mock';

/**
 * A page can only be trusted if it says when its data is not real. This banner
 * is rendered whenever the in-memory mock answers `/auth/*`.
 */
export function MockNotice() {
  if (!isMockEnabled()) {
    return null;
  }

  return (
    <div className="border-b border-warning/30 bg-warning-soft px-4 py-2 text-center text-xs font-medium text-warning sm:px-6">
      Mock API active. Accounts and sessions are simulated, not real.
    </div>
  );
}
