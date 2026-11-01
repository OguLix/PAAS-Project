'use client';

import { Button } from '@/components/ui/button';

type ErrorStateProps = {
  title: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
};

export function ErrorState({ title, message, onRetry, retryLabel = 'Try again' }: ErrorStateProps) {
  return (
    <div role="alert" className="rounded-panel border border-danger/30 bg-danger-soft px-6 py-8">
      <p className="font-display text-base font-semibold text-danger">{title}</p>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink">{message}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
