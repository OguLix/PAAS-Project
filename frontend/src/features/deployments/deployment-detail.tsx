'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { isTerminalDeploymentStatus, type ApplicationResponse } from '@ogulix/shared';
import { ErrorState } from '@/components/feedback/error-state';
import { LoadingState } from '@/components/feedback/loading-state';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DeploymentStatus } from '@/features/deployments/deployment-status';
import { messageForError } from '@/lib/errors';
import { applicationsApi } from '@/services/applications.api';
import { deploymentsApi } from '@/services/deployments.api';
import type { DeploymentLogEntry, DeploymentResponse } from '@/services/deployments.types';

function formatTime(value: string | null): string {
  return value ? new Date(value).toLocaleString() : 'Not recorded';
}

export function DeploymentDetail({ deploymentId }: { deploymentId: string }) {
  const [deployment, setDeployment] = useState<DeploymentResponse | null>(null);
  const [application, setApplication] = useState<ApplicationResponse | null>(null);
  const [logs, setLogs] = useState<DeploymentLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applicationError, setApplicationError] = useState<string | null>(null);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const applicationId = deployment?.applicationId;

  const loadDeployment = useCallback(
    async (showLoading = false) => {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);
      try {
        setDeployment(await deploymentsApi.get(deploymentId));
      } catch (requestError) {
        setError(messageForError(requestError));
      } finally {
        setLoading(false);
      }
    },
    [deploymentId],
  );

  const loadLogs = useCallback(async () => {
    if (!applicationId) {
      return;
    }
    setLogsLoading(true);
    setLogsError(null);
    try {
      setLogs(await applicationsApi.logs(applicationId));
    } catch (requestError) {
      setLogsError(messageForError(requestError));
    } finally {
      setLogsLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    void loadDeployment(true);
  }, [loadDeployment]);

  useEffect(() => {
    if (!deployment || isTerminalDeploymentStatus(deployment.status)) {
      return;
    }
    const timer = window.setInterval(() => {
      void loadDeployment();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [deployment?.status, loadDeployment]);

  useEffect(() => {
    if (applicationId) {
      setApplicationError(null);
      void applicationsApi
        .get(applicationId)
        .then(setApplication)
        .catch((requestError: unknown) => {
          setApplication(null);
          setApplicationError(messageForError(requestError));
        });
    }
  }, [applicationId]);

  useEffect(() => {
    if (applicationId) {
      void loadLogs();
    }
  }, [applicationId, loadLogs]);

  if (loading) {
    return <LoadingState label="Loading deployment" />;
  }
  if (error || !deployment) {
    return (
      <ErrorState
        title="Deployment could not be loaded"
        message={error ?? 'The API returned no deployment.'}
        onRetry={() => loadDeployment(true)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        {applicationError ? (
          <Alert tone="error" className="mb-4">
            {applicationError}
          </Alert>
        ) : null}
        {application ? (
          <Button asChild variant="ghost" size="sm" className="-ml-3 mb-2">
            <Link href={`/applications/${encodeURIComponent(application.id)}`}>
              Back to {application.name}
            </Link>
          </Button>
        ) : (
          <Button asChild variant="ghost" size="sm" className="-ml-3 mb-2">
            <Link href="/applications">Back to applications</Link>
          </Button>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-semibold text-ink">Deployment</h1>
          <DeploymentStatus status={deployment.status} />
        </div>
        <p className="mt-1 break-all font-mono text-xs text-muted">{deployment.id}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Deployment details</CardTitle>
          <CardDescription>
            {isTerminalDeploymentStatus(deployment.status)
              ? 'This deployment attempt has reached a terminal state.'
              : 'Status refreshes automatically while the deployment is in progress.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-5 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-muted">Created</dt>
              <dd className="mt-1 text-sm text-ink">{formatTime(deployment.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Started</dt>
              <dd className="mt-1 text-sm text-ink">{formatTime(deployment.startedAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Finished</dt>
              <dd className="mt-1 text-sm text-ink">{formatTime(deployment.finishedAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Commit</dt>
              <dd className="mt-1 break-all font-mono text-sm text-ink">
                {deployment.commitSha ?? 'Default branch head'}
              </dd>
            </div>
            {deployment.errorCode ? (
              <div>
                <dt className="text-xs font-medium text-muted">Error code</dt>
                <dd className="mt-1 font-mono text-sm text-danger">{deployment.errorCode}</dd>
              </div>
            ) : null}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Build and system logs</CardTitle>
            <CardDescription>Logs are bounded and redacted by the API.</CardDescription>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void loadLogs()}
            disabled={logsLoading}
          >
            {logsLoading ? 'Refreshing…' : 'Refresh logs'}
          </Button>
        </CardHeader>
        <CardContent>
          {logsError ? <Alert tone="error">{logsError}</Alert> : null}
          {!logsError && logs.length === 0 && !logsLoading ? (
            <p className="text-sm text-muted">No log entries were returned.</p>
          ) : null}
          {logs.length > 0 ? (
            <ol className="max-h-[28rem] divide-y divide-line overflow-auto rounded-lg border border-line">
              {logs.map((entry) => (
                <li
                  key={entry.sequence}
                  className="grid gap-2 px-4 py-3 sm:grid-cols-[9rem_4rem_1fr]"
                >
                  <time className="text-xs text-muted">{formatTime(entry.createdAt)}</time>
                  <span className="text-xs font-semibold text-muted">
                    {entry.level} · {entry.stream}
                  </span>
                  <pre className="overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-ink">
                    {entry.message}
                  </pre>
                </li>
              ))}
            </ol>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
