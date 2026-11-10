import Link from 'next/link';
import { Alert } from '@/components/ui/alert';
import { LoginForm } from '@/features/auth/login-form';
import { safeNextPath } from '@/lib/errors';

type LoginPageProps = {
  searchParams: Promise<{ next?: string; registered?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = safeNextPath(typeof params.next === 'string' ? params.next : undefined);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold text-ink">Sign in</h1>
        <p className="text-sm text-muted">Use your workspace account to continue.</p>
      </header>

      {params.registered ? (
        <Alert tone="success">Account created. Sign in to continue.</Alert>
      ) : null}

      <LoginForm nextPath={nextPath} />

      <p className="text-sm text-muted">
        Need an account?{' '}
        <Link href="/register" className="font-medium text-deep underline underline-offset-4">
          Create one
        </Link>
      </p>
    </div>
  );
}
