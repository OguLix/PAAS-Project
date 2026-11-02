'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApplicationForm } from '@/features/applications/application-form';

export default function NewApplicationPage() {
  const router = useRouter();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header>
        <Button asChild variant="ghost" size="sm" className="-ml-3 mb-2">
          <Link href="/applications">Back to applications</Link>
        </Button>
        <h1 className="font-display text-2xl font-semibold text-ink">Create application</h1>
        <p className="mt-1 text-sm text-muted">Connect a public HTTPS Git repository.</p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Application details</CardTitle>
          <CardDescription>
            Repository credentials and private URLs are not accepted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ApplicationForm
            onSaved={(application) =>
              router.replace(`/applications/${encodeURIComponent(application.id)}`)
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
