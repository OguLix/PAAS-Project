import type { ReactNode } from 'react';
import Link from 'next/link';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 rounded-lg">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-accent" />
          <span className="font-display text-lg font-semibold text-deep">OguLix PaaS</span>
        </Link>

        <div className="rounded-panel border border-line bg-white px-6 py-7">{children}</div>
      </div>
    </div>
  );
}
