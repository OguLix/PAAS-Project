'use client';

import { useId, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { signInErrorMessage } from '@/lib/errors';
import { authApi } from '@/services/auth.api';
import { loginSchema } from './schema';
import { setAuthenticated } from './session-store';

type FieldErrors = {
  email?: string;
  password?: string;
};

type LoginFormProps = {
  /** Validated same-origin path to open after a successful sign in. */
  nextPath: string;
};

export function LoginForm({ nextPath }: LoginFormProps) {
  const router = useRouter();
  const formId = useId();
  const emailId = `${formId}-email`;
  const passwordId = `${formId}-password`;

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setFormError(null);

    const formData = new FormData(event.currentTarget);
    const parsed = loginSchema.safeParse({
      email: String(formData.get('email') ?? ''),
      password: String(formData.get('password') ?? ''),
    });

    if (!parsed.success) {
      const next: FieldErrors = {};

      for (const issue of parsed.error.issues) {
        const key = issue.path[0];

        if (key === 'email' && !next.email) {
          next.email = issue.message;
        }

        if (key === 'password' && !next.password) {
          next.password = issue.message;
        }
      }

      setFieldErrors(next);
      return;
    }

    setFieldErrors({});
    setPending(true);

    try {
      const { user } = await authApi.login(parsed.data);
      setAuthenticated(user);
      router.replace(nextPath);
      router.refresh();
    } catch (error) {
      setFormError(signInErrorMessage(error));
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

      <Field id={passwordId} label="Password" error={fieldErrors.password}>
        <Input
          id={passwordId}
          name="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={fieldErrors.password ? true : undefined}
          aria-describedby={fieldErrors.password ? `${passwordId}-error` : undefined}
        />
      </Field>

      <Button type="submit" disabled={pending} className="mt-1">
        {pending ? 'Signing in' : 'Sign in'}
      </Button>
    </form>
  );
}
