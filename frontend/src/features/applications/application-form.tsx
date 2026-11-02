'use client';

import { useState, type FormEvent } from 'react';
import type { ApplicationResponse } from '@ogulix/shared';
import { createApplicationInputSchema, updateApplicationInputSchema } from '@ogulix/shared';
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
};

type FormErrors = Partial<Record<keyof FormFields, string>>;

export function ApplicationForm({ application, onSaved }: ApplicationFormProps) {
  const [values, setValues] = useState<FormFields>({
    name: application?.name ?? '',
    sourceRepository: application?.sourceRepository ?? '',
    defaultBranch: application?.defaultBranch ?? 'main',
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
    const showValidationErrors = (issues: readonly { path: PropertyKey[]; message: string }[]) => {
      const nextErrors: FormErrors = {};
      for (const issue of issues) {
        const field = issue.path[0];
        if (
          (field === 'name' || field === 'sourceRepository' || field === 'defaultBranch') &&
          !nextErrors[field]
        ) {
          nextErrors[field] = issue.message;
        }
      }
      setErrors(nextErrors);
    };

    setPending(true);
    try {
      let saved: ApplicationResponse;
      if (application) {
        const parsed = updateApplicationInputSchema.safeParse(values);
        if (!parsed.success) {
          showValidationErrors(parsed.error.issues);
          return;
        }
        saved = await applicationsApi.update(application.id, parsed.data);
      } else {
        const parsed = createApplicationInputSchema.safeParse(values);
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
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : application ? 'Save changes' : 'Create application'}
        </Button>
      </div>
    </form>
  );
}
