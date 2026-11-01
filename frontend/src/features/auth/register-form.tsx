'use client';

import { useId, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { messageForError } from '@/lib/errors';
import { authApi } from '@/services/auth.api';
import { registerSchema } from './schema';

type FieldErrors = {
  email?: string;
  password?: string;
  confirmPassword?: string;
};

const FIELD_KEYS = ['email', 'password', 'confirmPassword'] as const;

export function RegisterForm() {
  const router = useRouter();
  const formId = useId();
  const emailId = `${formId}-email`;
  const passwordId = `${formId}-password`;
  const confirmId = `${formId}-confirm`;

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);

    const formData = new FormData(event.currentTarget);
    const parsed = registerSchema.safeParse({
      email: String(formData.get('email') ?? ''),
      password: String(formData.get('password') ?? ''),
      confirmPassword: String(formData.get('confirmPassword') ?? ''),
    });

    if (!parsed.success) {
      const next: FieldErrors = {};

      for (const issue of parsed.error.issues) {
        const key = issue.path[0];

        if (typeof key !== 'string') {
          continue;
        }

        if ((FIELD_KEYS as readonly string[]).includes(key) && !next[key as keyof FieldErrors]) {
          next[key as keyof FieldErrors] = issue.message;
        }
      }

      setFieldErrors(next);
      return;
    }

    setFieldErrors({});
    setPending(true);

    try {
      await authApi.register({ email: parsed.data.email, password: parsed.data.password });
      // The registration response is not assumed to set a session cookie, so the
      // user is asked to sign in instead of dropping them into a half-authenticated
      // dashboard.
      router.replace('/login?registered=1');
    } catch (error) {
      setFormError(messageForError(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
      {formError ? <Alert tone="error">{formError}</Alert> : null}

      <Field id={emailId} label="Email" error={fieldErrors.email}>
        <Input
          id={emailId}
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          aria-invalid={fieldErrors.email ? true : undefined}
          aria-describedby={fieldErrors.email ? `${emailId}-error` : undefined}
        />
      </Field>

      <Field
        id={passwordId}
        label="Password"
        hint="At least 8 characters."
        error={fieldErrors.password}
      >
        <Input
          id={passwordId}
          name="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={fieldErrors.password ? true : undefined}
          aria-describedby={fieldErrors.password ? `${passwordId}-error` : `${passwordId}-hint`}
        />
      </Field>

      <Field id={confirmId} label="Repeat password" error={fieldErrors.confirmPassword}>
        <Input
          id={confirmId}
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={fieldErrors.confirmPassword ? true : undefined}
          aria-describedby={fieldErrors.confirmPassword ? `${confirmId}-error` : undefined}
        />
      </Field>

      <Button type="submit" disabled={pending} className="mt-1">
        {pending ? 'Creating account' : 'Create account'}
      </Button>
    </form>
  );
}
