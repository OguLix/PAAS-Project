'use client';

import { EmptyState } from '@/components/feedback/empty-state';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSession } from '@/features/auth/session-store';

export default function DashboardPage() {
  const session = useSession();
  const email = session.user?.email ?? 'your account';

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold text-ink">Dashboard</h1>
        <p className="text-sm text-muted">Signed in as {email}.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Workspace overview</CardTitle>
          <CardDescription>What this build can and cannot show yet.</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="Nothing to display yet"
            description="Application, deployment, log and runtime node views belong to the next milestone. This screen shows no sample numbers and no placeholder records."
          />
        </CardContent>
      </Card>
    </div>
  );
}
