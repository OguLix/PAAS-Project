import type { ReactNode } from 'react';
import { Topbar } from './topbar';

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">{children}</main>
      <footer className="border-t border-line px-4 py-4 text-xs text-muted sm:px-6">
        OguLix PaaS, academic MVP.
      </footer>
    </div>
  );
}
