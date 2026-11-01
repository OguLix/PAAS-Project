import type { ReactNode } from 'react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { SessionGuard } from '@/features/auth/session-guard';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <SessionGuard>
      <DashboardShell>{children}</DashboardShell>
    </SessionGuard>
  );
}
