import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-sm font-medium text-muted">404</p>
      <h1 className="font-display text-2xl font-semibold text-ink">Page not found</h1>
      <p className="max-w-sm text-sm leading-relaxed text-muted">
        This address does not belong to the workspace. Check the link or return to the dashboard.
      </p>
      <Button asChild variant="secondary" className="mt-3">
        <Link href="/dashboard">Go to dashboard</Link>
      </Button>
    </main>
  );
}
