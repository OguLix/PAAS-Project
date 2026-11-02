'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { ApplicationResponse } from '@ogulix/shared';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { LoadingState } from '@/components/feedback/loading-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { messageForError } from '@/lib/errors';
import { applicationsApi } from '@/services/applications.api';

const PAGE_SIZE = 20;

export function ApplicationList() {
  const [applications, setApplications] = useState<ApplicationResponse[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadApplications = useCallback(async (requestedPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await applicationsApi.list(requestedPage, PAGE_SIZE);
      setApplications(result.applications);
      setTotal(result.total);
    } catch (requestError) {
      setError(messageForError(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadApplications(page);
  }, [loadApplications, page]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Applications</h1>
          <p className="mt-1 text-sm text-muted">Manage your services and deployment history.</p>
        </div>
        <Button asChild>
          <Link href="/applications/new">Create application</Link>
        </Button>
      </header>

      {loading ? <LoadingState label="Loading applications" /> : null}
      {!loading && error ? (
        <ErrorState
          title="Applications could not be loaded"
          message={error}
          onRetry={() => loadApplications(page)}
        />
      ) : null}
      {!loading && !error && applications.length === 0 ? (
        <EmptyState
          title="No applications yet"
          description="Create an application to connect a public HTTPS repository and manage its deployments."
          action={
            <Button asChild>
              <Link href="/applications/new">Create your first application</Link>
            </Button>
          }
        />
      ) : null}
      {!loading && !error && applications.length > 0 ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            {applications.map((application) => (
              <Card key={application.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
                  <div className="min-w-0">
                    <h2 className="font-display font-semibold text-ink">{application.name}</h2>
                    <p className="mt-1 truncate text-sm text-muted">
                      {application.sourceRepository}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Default branch: {application.defaultBranch}
                    </p>
                  </div>
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/applications/${encodeURIComponent(application.id)}`}>
                      View application
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          {total > PAGE_SIZE ? (
            <nav aria-label="Application pages" className="flex items-center justify-between">
              <p className="text-sm text-muted">
                Page {page} of {Math.ceil(total / PAGE_SIZE)}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={page === 1 || loading}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={page >= Math.ceil(total / PAGE_SIZE) || loading}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </Button>
              </div>
            </nav>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
