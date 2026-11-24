'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSession } from '@/features/auth/session-store';
import { applicationsApi } from '@/services/applications.api';
import { nodesApi } from '@/services/nodes.api';

export default function DashboardPage() {
  const session = useSession();
  const email = session.user?.email ?? 'your account';
  const [appCount, setAppCount] = useState<number | null>(null);
  const [nodeSummary, setNodeSummary] = useState<{ online: number; total: number } | null>(null);

  useEffect(() => {
    void applicationsApi
      .list(1, 1)
      .then((result) => setAppCount(result.total))
      .catch(() => setAppCount(null));

    void nodesApi
      .list()
      .then((nodes) =>
        setNodeSummary({
          online: nodes.filter((node) => node.status === 'ONLINE').length,
          total: nodes.length,
        }),
      )
      .catch(() => setNodeSummary(null));
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-semibold text-ink">Dashboard</h1>
          <p className="text-sm text-muted">Signed in as {email}.</p>
        </div>
        <Button asChild>
          <Link href="/applications/new">Create application</Link>
        </Button>
      </header>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Applications</CardTitle>
            <CardDescription>Active applications owned by your account.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between gap-4">
            <p className="font-display text-3xl font-semibold text-ink">
              {appCount === null ? '—' : appCount}
            </p>
            <Button asChild variant="secondary" size="sm">
              <Link href="/applications">View applications</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Runtime nodes</CardTitle>
            <CardDescription>Online capacity available for deployment scheduling.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between gap-4">
            <p className="font-display text-3xl font-semibold text-ink">
              {nodeSummary === null ? '—' : `${nodeSummary.online} / ${nodeSummary.total}`}
            </p>
            <Button asChild variant="secondary" size="sm">
              <Link href="/nodes">Inspect nodes</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
