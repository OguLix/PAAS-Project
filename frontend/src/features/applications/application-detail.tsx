'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ApplicationResponse } from '@ogulix/shared';
import { deployInputSchema } from '@ogulix/shared';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { LoadingState } from '@/components/feedback/loading-state';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ApplicationForm } from '@/features/applications/application-form';
import { DeploymentStatus } from '@/features/deployments/deployment-status';
import { messageForError } from '@/lib/errors';
import { applicationsApi } from '@/services/applications.api';
import type { DeploymentResponse } from '@/services/deployments.types';

export function ApplicationDetail({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [application, setApplication] = useState<ApplicationResponse | null>(null);
  const [deployments, setDeployments] = useState<DeploymentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [branch, setBranch] = useState('');
  const [commitSha, setCommitSha] = useState('');
  const [deployError, setDeployError] = useState<string | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const loadApplication = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    setHistoryError(null);
    try {
      setApplication(await applicationsApi.get(applicationId));
      try {
        setDeployments(await applicationsApi.deployments(applicationId));
      } catch (error) {
        setHistoryError(messageForError(error));
      }
    } catch (error) {
      setPageError(messageForError(error));
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    void loadApplication();
  }, [loadApplication]);

  async function handleDeploy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDeployError(null);
    const parsed = deployInputSchema.safeParse({
      ...(branch.trim() ? { branch: branch.trim() } : {}),
      ...(commitSha.trim() ? { commitSha: commitSha.trim() } : {}),
    });
    if (!parsed.success) {
      setDeployError(parsed.error.issues[0]?.message ?? 'Check the deployment input.');
      return;
    }

    setDeploying(true);
    try {
      const deployment = await applicationsApi.deploy(applicationId, parsed.data);
      router.push(`/deployments/${encodeURIComponent(deployment.id)}`);
    } catch (error) {
      setDeployError(messageForError(error));
    } finally {
      setDeploying(false);
    }
  }

  async function handleArchive() {
    if (!window.confirm('Archive this application? Its deployment history will be preserved.')) {
      return;
    }
    setArchiveError(null);
    try {
      await applicationsApi.archive(applicationId);
      router.replace('/applications');
    } catch (error) {
      setArchiveError(messageForError(error));
    }
  }

  if (loading) {
    return <LoadingState label="Loading application" />;
  }
  if (pageError || !application) {
    return (
      <ErrorState
        title="Application could not be loaded"
        message={pageError ?? 'The API returned no application.'}
        onRetry={loadApplication}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-3 mb-2">
            <Link href="/applications">Back to applications</Link>
          </Button>
          <h1 className="font-display text-2xl font-semibold text-ink">{application.name}</h1>
          <p className="mt-1 break-all text-sm text-muted">{application.sourceRepository}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setEditing((value) => !value)}>
            {editing ? 'Close edit' : 'Edit application'}
          </Button>
          <Button variant="danger" onClick={handleArchive}>
            Archive
          </Button>
        </div>
      </header>

      {archiveError ? <Alert tone="error">{archiveError}</Alert> : null}

      {editing ? (
        <Card>
          <CardHeader>
            <CardTitle>Edit application</CardTitle>
          </CardHeader>
          <CardContent>
            <ApplicationForm
              application={application}
              onSaved={(saved) => {
                setApplication(saved);
                setEditing(false);
              }}
            />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Deploy a revision</CardTitle>
            <CardDescription>
              Leave branch and commit empty to deploy the configured default branch.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleDeploy} className="flex flex-col gap-4">
              {deployError ? <Alert tone="error">{deployError}</Alert> : null}
              <Field
                id="deploy-branch"
                label="Branch"
                hint={`Default: ${application.defaultBranch}`}
              >
                <Input
                  id="deploy-branch"
                  value={branch}
                  onChange={(event) => setBranch(event.target.value)}
                  maxLength={255}
                />
              </Field>
              <Field
                id="deploy-commit"
                label="Commit SHA"
                hint="Optional; hexadecimal, 7–64 characters."
              >
                <Input
                  id="deploy-commit"
                  value={commitSha}
                  onChange={(event) => setCommitSha(event.target.value)}
                  maxLength={64}
                />
              </Field>
              <Button type="submit" disabled={deploying}>
                {deploying ? 'Requesting deployment…' : 'Deploy'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monitoring</CardTitle>
            <CardDescription>
              Runtime metrics are not available in the current API contract.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState
              title="No telemetry available"
              description="CPU, memory, and request metrics will appear when a monitoring endpoint is implemented. No sample values are shown."
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Deployment history</CardTitle>
          <CardDescription>Each release attempt keeps its own lifecycle status.</CardDescription>
        </CardHeader>
        <CardContent>
          {historyError ? (
            <ErrorState
              title="Deployment history could not be loaded"
              message={historyError}
              onRetry={loadApplication}
            />
          ) : deployments.length === 0 ? (
            <EmptyState
              title="No deployments yet"
              description="A deployment will be listed here after the API accepts your first request."
            />
          ) : (
            <div className="divide-y divide-line">
              {deployments.map((deployment) => (
                <Link
                  key={deployment.id}
                  href={`/deployments/${encodeURIComponent(deployment.id)}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
                >
                  <span className="min-w-0">
                    <span className="block font-medium text-ink">
                      Deployment {deployment.id.slice(0, 8)}
                    </span>
                    <span className="mt-1 block text-xs text-muted">
                      {new Date(deployment.createdAt).toLocaleString()}
                      {deployment.commitSha ? ` · ${deployment.commitSha.slice(0, 12)}` : ''}
                    </span>
                  </span>
                  <DeploymentStatus status={deployment.status} />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
