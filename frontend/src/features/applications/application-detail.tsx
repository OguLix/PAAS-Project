'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  createDomainInputSchema,
  deployInputSchema,
  environmentVariableInputSchema,
  environmentVariableKeySchema,
  type ApplicationResponse,
  type DomainResponse,
  type EnvironmentVariableSummary,
} from '@ogulix/shared';
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
import { domainsApi } from '@/services/domains.api';
import { envApi } from '@/services/env.api';

export function ApplicationDetail({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [application, setApplication] = useState<ApplicationResponse | null>(null);
  const [deployments, setDeployments] = useState<DeploymentResponse[]>([]);
  const [domains, setDomains] = useState<DomainResponse[]>([]);
  const [envVars, setEnvVars] = useState<EnvironmentVariableSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const [branch, setBranch] = useState('');
  const [commitSha, setCommitSha] = useState('');
  const [deployError, setDeployError] = useState<string | null>(null);
  const [deploying, setDeploying] = useState(false);
  const deployIdempotencyKey = useRef<string | null>(null);

  const [hostname, setHostname] = useState('');
  const [domainError, setDomainError] = useState<string | null>(null);
  const [domainPending, setDomainPending] = useState(false);

  const [envKey, setEnvKey] = useState('');
  const [envValue, setEnvValue] = useState('');
  const [envError, setEnvError] = useState<string | null>(null);
  const [envPending, setEnvPending] = useState(false);

  const [archiveError, setArchiveError] = useState<string | null>(null);

  const loadApplication = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    setHistoryError(null);
    try {
      const app = await applicationsApi.get(applicationId);
      setApplication(app);

      const [deploymentsResult, domainsResult, envResult] = await Promise.allSettled([
        applicationsApi.deployments(applicationId),
        domainsApi.list(applicationId),
        envApi.list(applicationId),
      ]);

      if (deploymentsResult.status === 'fulfilled') {
        setDeployments(deploymentsResult.value);
      } else {
        setHistoryError(messageForError(deploymentsResult.reason));
      }

      if (domainsResult.status === 'fulfilled') {
        setDomains(domainsResult.value);
      } else {
        setDomainError(messageForError(domainsResult.reason));
      }

      if (envResult.status === 'fulfilled') {
        setEnvVars(envResult.value);
      } else {
        setEnvError(messageForError(envResult.reason));
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

  function resetDeployKey() {
    deployIdempotencyKey.current = null;
  }

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

    deployIdempotencyKey.current ??= crypto.randomUUID();
    setDeploying(true);
    try {
      const deployment = await applicationsApi.deploy(
        applicationId,
        parsed.data,
        deployIdempotencyKey.current,
      );
      resetDeployKey();
      router.push(`/deployments/${encodeURIComponent(deployment.id)}`);
    } catch (error) {
      setDeployError(messageForError(error));
    } finally {
      setDeploying(false);
    }
  }

  async function handleAddDomain(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDomainError(null);
    const parsed = createDomainInputSchema.safeParse({ hostname });
    if (!parsed.success) {
      setDomainError(parsed.error.issues[0]?.message ?? 'Enter a valid apps.ogulix.tech hostname.');
      return;
    }

    setDomainPending(true);
    try {
      const created = await domainsApi.create(applicationId, parsed.data);
      setDomains((current) => [...current, created]);
      setHostname('');
    } catch (error) {
      setDomainError(messageForError(error));
    } finally {
      setDomainPending(false);
    }
  }

  async function handleDisableDomain(domainId: string) {
    setDomainError(null);
    try {
      const disabled = await domainsApi.disable(domainId);
      setDomains((current) => current.map((item) => (item.id === domainId ? disabled : item)));
    } catch (error) {
      setDomainError(messageForError(error));
    }
  }

  async function handleSaveEnv(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEnvError(null);

    const parsedKey = environmentVariableKeySchema.safeParse(envKey.trim());
    if (!parsedKey.success) {
      setEnvError(parsedKey.error.issues[0]?.message ?? 'Enter a valid CONSTANT_CASE key.');
      return;
    }
    const parsedInput = environmentVariableInputSchema.safeParse({
      value: envValue,
      isSecret: true,
    });
    if (!parsedInput.success) {
      setEnvError(parsedInput.error.issues[0]?.message ?? 'Invalid environment variable value.');
      return;
    }

    setEnvPending(true);
    try {
      const saved = await envApi.upsert(applicationId, parsedKey.data, parsedInput.data);
      setEnvVars((current) => {
        const filtered = current.filter((item) => item.key !== saved.key);
        return [...filtered, saved].sort((left, right) => left.key.localeCompare(right.key));
      });
      setEnvKey('');
      setEnvValue('');
    } catch (error) {
      setEnvError(messageForError(error));
    } finally {
      setEnvPending(false);
    }
  }

  async function handleDeleteEnv(key: string) {
    setEnvError(null);
    try {
      await envApi.remove(applicationId, key);
      setEnvVars((current) => current.filter((item) => item.key !== key));
    } catch (error) {
      setEnvError(messageForError(error));
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
                  onChange={(event) => {
                    setBranch(event.target.value);
                    resetDeployKey();
                  }}
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
                  onChange={(event) => {
                    setCommitSha(event.target.value);
                    resetDeployKey();
                  }}
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
            <CardTitle>Runtime configuration</CardTitle>
            <CardDescription>
              Build and resource limits applied to every container deployment.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-muted">Dockerfile</dt>
                <dd className="mt-1 font-mono text-ink">{application.dockerfilePath}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Build context</dt>
                <dd className="mt-1 font-mono text-ink">{application.buildContext}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Internal port</dt>
                <dd className="mt-1 font-mono text-ink">{application.internalPort}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Health check</dt>
                <dd className="mt-1 font-mono text-ink">{application.healthCheckPath}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Limits</dt>
                <dd className="mt-1 font-mono text-ink">
                  {application.cpuCores} CPU · {application.memoryMb} MiB · {application.pidsLimit}{' '}
                  PIDs
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Live deployment</dt>
                <dd className="mt-1 font-mono text-ink">
                  {application.currentDeploymentId
                    ? application.currentDeploymentId.slice(0, 8)
                    : 'None'}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Domains</CardTitle>
            <CardDescription>Associate a single subdomain under apps.ogulix.tech.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {domainError ? <Alert tone="error">{domainError}</Alert> : null}
            <form
              onSubmit={handleAddDomain}
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
            >
              <div className="flex-1">
                <Field id="domain-hostname" label="Hostname">
                  <Input
                    id="domain-hostname"
                    value={hostname}
                    onChange={(event) => setHostname(event.target.value)}
                    placeholder="demo.apps.ogulix.tech"
                    maxLength={253}
                  />
                </Field>
              </div>
              <Button type="submit" size="sm" disabled={domainPending}>
                {domainPending ? 'Adding…' : 'Add domain'}
              </Button>
            </form>
            {domains.length === 0 ? (
              <p className="text-sm text-muted">No domains associated yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {domains.map((domain) => (
                  <li key={domain.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm text-ink">{domain.hostname}</p>
                      <p className="text-xs text-muted">
                        {domain.status}
                        {domain.isPrimary ? ' · Primary' : ''}
                      </p>
                    </div>
                    {domain.status !== 'DISABLED' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleDisableDomain(domain.id)}
                      >
                        Disable
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Environment variables</CardTitle>
            <CardDescription>
              Values are encrypted at rest and never returned after saving.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {envError ? <Alert tone="error">{envError}</Alert> : null}
            <form onSubmit={handleSaveEnv} className="flex flex-col gap-3">
              <Field id="env-key" label="Key (CONSTANT_CASE)">
                <Input
                  id="env-key"
                  value={envKey}
                  onChange={(event) => setEnvKey(event.target.value)}
                  placeholder="API_TOKEN"
                  maxLength={128}
                />
              </Field>
              <Field id="env-value" label="Secret value">
                <Input
                  id="env-value"
                  type="password"
                  value={envValue}
                  onChange={(event) => setEnvValue(event.target.value)}
                  autoComplete="new-password"
                />
              </Field>
              <div>
                <Button type="submit" size="sm" disabled={envPending}>
                  {envPending ? 'Saving…' : 'Save variable'}
                </Button>
              </div>
            </form>
            {envVars.length === 0 ? (
              <p className="text-sm text-muted">No environment variables configured.</p>
            ) : (
              <ul className="divide-y divide-line">
                {envVars.map((variable) => (
                  <li key={variable.key} className="flex items-center justify-between gap-3 py-2.5">
                    <div>
                      <p className="font-mono text-sm text-ink">{variable.key}</p>
                      <p className="text-xs text-muted">
                        {variable.isSecret ? 'Encrypted secret' : 'Encrypted value'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleDeleteEnv(variable.key)}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
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
                      {deployment.branch ? ` · ${deployment.branch}` : ''}
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
