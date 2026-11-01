import Link from 'next/link';
import { RegisterForm } from '@/features/auth/register-form';

export default function RegisterPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold text-ink">Create account</h1>
        <p className="text-sm text-muted">
          Registration may be disabled by the workspace owner. If it is closed, the form reports it
          without creating anything.
        </p>
      </header>

      <RegisterForm />

      <p className="text-sm text-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-deep underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  );
}
