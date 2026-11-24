'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
  const [deployment, setDeployment] = useState<DeploymentResponse | null>(null);
  const [application, setApplication] = useState<ApplicationResponse | null>(null);
  const [logs, setLogs] = useState<DeploymentLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applicationError, setApplicationError] = useState<string | null>(null);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [actionPending, setActionPending] = useState<'cancel' | 'stop' | 'restart' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
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

  const loadLogs = useCallback(
    async (showLoading = true) => {
      if (showLoading) {
        setLogsLoading(true);
      }
      setLogsError(null);
      try {
        setLogs(await deploymentsApi.logs(deploymentId));
      } catch (requestError) {
        setLogsError(messageForError(requestError));
      } finally {
        if (showLoading) {
          setLogsLoading(false);
        }
      }
    },
    [deploymentId],
  );

  useEffect(() => {
    void loadDeployment(true);
    void loadLogs(true);
  }, [loadDeployment, loadLogs]);

  useEffect(() => {
    if (!deployment || isTerminalDeploymentStatus(deployment.status)) {
      return;
    }
    const timer = window.setInterval(() => {
      void loadDeployment(false);
      void loadLogs(false);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [deployment?.status, loadDeployment, loadLogs]);

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

  async function handleCancel() {
    setActionError(null);
    setActionPending('cancel');
    try {
      setDeployment(await deploymentsApi.cancel(deploymentId));
    } catch (requestError) {
      setActionError(messageForError(requestError));
    } finally {
      setActionPending(null);
    }
  }

  async function handleStop() {
    setActionError(null);
    setActionPending('stop');
    try {
      setDeployment(await deploymentsApi.stop(deploymentId));
    } catch (requestError) {
      setActionError(messageForError(requestError));
    } finally {
      setActionPending(null);
    }
  }

  async function handleRestart() {
    setActionError(null);
    setActionPending('restart');
    try {
      const next = await deploymentsApi.restart(deploymentId);
      router.push(`/deployments/${encodeURIComponent(next.id)}`);
    } catch (requestError) {
      setActionError(messageForError(requestError));
    } finally {
      setActionPending(null);
    }
  }

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
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
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
        </div>
        <div className="flex flex-wrap gap-2">
          {deployment.status === 'QUEUED' ? (
            <Button
              variant="danger"
              size="sm"
              disabled={actionPending !== null}
              onClick={() => void handleCancel()}
            >
              {actionPending === 'cancel' ? 'Cancelling…' : 'Cancel'}
            </Button>
          ) : null}
          {deployment.status === 'RUNNING' ? (
            <Button
              variant="danger"
              size="sm"
              disabled={actionPending !== null}
              onClick={() => void handleStop()}
            >
              {actionPending === 'stop' ? 'Stopping…' : 'Stop'}
            </Button>
          ) : null}
          {isTerminalDeploymentStatus(deployment.status) ? (
            <Button
              variant="secondary"
              size="sm"
              disabled={actionPending !== null}
              onClick={() => void handleRestart()}
            >
              {actionPending === 'restart' ? 'Restarting…' : 'Restart as new attempt'}
            </Button>
          ) : null}
        </div>
      </header>

      {actionError ? <Alert tone="error">{actionError}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle>Deployment details</CardTitle>
          <CardDescription>
            {isTerminalDeploymentStatus(deployment.status)
              ? 'This deployment attempt has reached a terminal state.'
              : 'Status and logs refresh automatically while the deployment is in progress.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-5 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-muted">Branch</dt>
              <dd className="mt-1 font-mono text-sm text-ink">
                {deployment.branch ?? 'Default branch'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted">Commit</dt>
              <dd className="mt-1 break-all font-mono text-sm text-ink">
                {deployment.commitSha ?? 'Branch head'}
              </dd>
            </div>
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
            {deployment.errorCode ? (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-muted">Failure reason</dt>
                <dd className="mt-1 text-sm text-danger">
                  <span className="font-mono font-semibold">{deployment.errorCode}</span>
                  {deployment.errorMessage ? ` — ${deployment.errorMessage}` : ''}
                </dd>
              </div>
            ) : null}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Build and system logs</CardTitle>
            <CardDescription>
              Deployment-scoped logs, bounded and redacted by the API.
            </CardDescription>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void loadLogs(true)}
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
                  className="grid gap-2 px-4 py-3 sm:grid-cols-[9rem_6rem_1fr]"
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
