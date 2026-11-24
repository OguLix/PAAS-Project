'use client';

import { useState, type FormEvent } from 'react';
import {
  DEFAULT_APPLICATION_CONFIG,
  createApplicationInputSchema,
  updateApplicationInputSchema,
  type ApplicationResponse,
} from '@ogulix/shared';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { messageForError } from '@/lib/errors';
import { applicationsApi } from '@/services/applications.api';

type ApplicationFormProps = {
  application?: ApplicationResponse;
  onSaved: (application: ApplicationResponse) => void;
};

type FormFields = {
  name: string;
  sourceRepository: string;
  defaultBranch: string;
  dockerfilePath: string;
  buildContext: string;
  internalPort: string;
  healthCheckPath: string;
  cpuCores: string;
  memoryMb: string;
  pidsLimit: string;
};

const FIELD_NAMES: ReadonlyArray<keyof FormFields> = [
  'name',
  'sourceRepository',
  'defaultBranch',
  'dockerfilePath',
  'buildContext',
  'internalPort',
  'healthCheckPath',
  'cpuCores',
  'memoryMb',
  'pidsLimit',
];

type FormErrors = Partial<Record<keyof FormFields, string>>;

export function ApplicationForm({ application, onSaved }: ApplicationFormProps) {
  const [values, setValues] = useState<FormFields>({
    name: application?.name ?? '',
    sourceRepository: application?.sourceRepository ?? '',
    defaultBranch: application?.defaultBranch ?? 'main',
    dockerfilePath: application?.dockerfilePath ?? DEFAULT_APPLICATION_CONFIG.dockerfilePath,
    buildContext: application?.buildContext ?? DEFAULT_APPLICATION_CONFIG.buildContext,
    internalPort: String(application?.internalPort ?? DEFAULT_APPLICATION_CONFIG.internalPort),
    healthCheckPath: application?.healthCheckPath ?? DEFAULT_APPLICATION_CONFIG.healthCheckPath,
    cpuCores: String(application?.cpuCores ?? DEFAULT_APPLICATION_CONFIG.cpuCores),
    memoryMb: String(application?.memoryMb ?? DEFAULT_APPLICATION_CONFIG.memoryMb),
    pidsLimit: String(application?.pidsLimit ?? DEFAULT_APPLICATION_CONFIG.pidsLimit),
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function updateField(field: keyof FormFields, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestError(null);

    const candidate = {
      name: values.name,
      sourceRepository: values.sourceRepository,
      defaultBranch: values.defaultBranch,
      dockerfilePath: values.dockerfilePath,
      buildContext: values.buildContext,
      internalPort: Number(values.internalPort),
      healthCheckPath: values.healthCheckPath,
      cpuCores: Number(values.cpuCores),
      memoryMb: Number(values.memoryMb),
      pidsLimit: Number(values.pidsLimit),
    };

    const showValidationErrors = (issues: readonly { path: PropertyKey[]; message: string }[]) => {
      const nextErrors: FormErrors = {};
      for (const issue of issues) {
        const field = issue.path[0];
        if (
          typeof field === 'string' &&
          (FIELD_NAMES as readonly string[]).includes(field) &&
          !nextErrors[field as keyof FormFields]
        ) {
          nextErrors[field as keyof FormFields] = issue.message;
        }
      }
      setErrors(nextErrors);
    };

    setPending(true);
    try {
      let saved: ApplicationResponse;
      if (application) {
        const parsed = updateApplicationInputSchema.safeParse(candidate);
        if (!parsed.success) {
          showValidationErrors(parsed.error.issues);
          return;
        }
        saved = await applicationsApi.update(application.id, parsed.data);
      } else {
        const parsed = createApplicationInputSchema.safeParse(candidate);
        if (!parsed.success) {
          showValidationErrors(parsed.error.issues);
          return;
        }
        saved = await applicationsApi.create(parsed.data);
      }
      onSaved(saved);
    } catch (error) {
      setRequestError(messageForError(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {requestError ? <Alert tone="error">{requestError}</Alert> : null}
      <Field id="application-name" label="Application name" error={errors.name}>
        <Input
          id="application-name"
          value={values.name}
          onChange={(event) => updateField('name', event.target.value)}
          autoComplete="off"
          required
          maxLength={120}
          aria-invalid={Boolean(errors.name)}
        />
      </Field>
      <Field
        id="source-repository"
        label="Public HTTPS repository"
        hint="Repository URLs containing credentials are not accepted."
        error={errors.sourceRepository}
      >
        <Input
          id="source-repository"
          type="url"
          value={values.sourceRepository}
          onChange={(event) => updateField('sourceRepository', event.target.value)}
          placeholder="https://github.com/org/repository"
          required
          maxLength={2048}
          aria-invalid={Boolean(errors.sourceRepository)}
        />
      </Field>
      <Field id="default-branch" label="Default branch" error={errors.defaultBranch}>
        <Input
          id="default-branch"
          value={values.defaultBranch}
          onChange={(event) => updateField('defaultBranch', event.target.value)}
          required
          maxLength={255}
          aria-invalid={Boolean(errors.defaultBranch)}
        />
      </Field>

      <fieldset className="grid gap-4 rounded-lg border border-line p-4 sm:grid-cols-2">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">
          Build &amp; runtime configuration
        </legend>
        <Field id="dockerfile-path" label="Dockerfile path" error={errors.dockerfilePath}>
          <Input
            id="dockerfile-path"
            value={values.dockerfilePath}
            onChange={(event) => updateField('dockerfilePath', event.target.value)}
            maxLength={255}
            aria-invalid={Boolean(errors.dockerfilePath)}
          />
        </Field>
        <Field id="build-context" label="Build context" error={errors.buildContext}>
          <Input
            id="build-context"
            value={values.buildContext}
            onChange={(event) => updateField('buildContext', event.target.value)}
            maxLength={255}
            aria-invalid={Boolean(errors.buildContext)}
          />
        </Field>
        <Field id="internal-port" label="Internal port" error={errors.internalPort}>
          <Input
            id="internal-port"
            type="number"
            min={1}
            max={65535}
            value={values.internalPort}
            onChange={(event) => updateField('internalPort', event.target.value)}
            aria-invalid={Boolean(errors.internalPort)}
          />
        </Field>
        <Field id="health-check-path" label="Health check path" error={errors.healthCheckPath}>
          <Input
            id="health-check-path"
            value={values.healthCheckPath}
            onChange={(event) => updateField('healthCheckPath', event.target.value)}
            maxLength={255}
            aria-invalid={Boolean(errors.healthCheckPath)}
          />
        </Field>
        <Field id="cpu-cores" label="CPU cores (0.1–1.5)" error={errors.cpuCores}>
          <Input
            id="cpu-cores"
            type="number"
            step="0.1"
            min={0.1}
            max={1.5}
            value={values.cpuCores}
            onChange={(event) => updateField('cpuCores', event.target.value)}
            aria-invalid={Boolean(errors.cpuCores)}
          />
        </Field>
        <Field id="memory-mb" label="Memory MiB (64–1024)" error={errors.memoryMb}>
          <Input
            id="memory-mb"
            type="number"
            min={64}
            max={1024}
            value={values.memoryMb}
            onChange={(event) => updateField('memoryMb', event.target.value)}
            aria-invalid={Boolean(errors.memoryMb)}
          />
        </Field>
        <Field id="pids-limit" label="PID limit (16–512)" error={errors.pidsLimit}>
          <Input
            id="pids-limit"
            type="number"
            min={16}
            max={512}
            value={values.pidsLimit}
            onChange={(event) => updateField('pidsLimit', event.target.value)}
            aria-invalid={Boolean(errors.pidsLimit)}
          />
        </Field>
      </fieldset>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : application ? 'Save changes' : 'Create application'}
        </Button>
      </div>
    </form>
  );
}
