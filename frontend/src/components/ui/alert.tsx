import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type AlertTone = 'error' | 'success' | 'info';

const TONE_CLASSES: Record<AlertTone, string> = {
  error: 'border-danger/30 bg-danger-soft text-danger',
  success: 'border-accent/40 bg-success-soft text-deep',
  info: 'border-line bg-subtle text-ink',
};

type AlertProps = {
  tone?: AlertTone;
  title?: string;
  children: ReactNode;
  className?: string;
};

export function Alert({ tone = 'info', title, children, className }: AlertProps) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('rounded-lg border px-4 py-3 text-sm', TONE_CLASSES[tone], className)}
    >
      {title ? <p className="font-semibold">{title}</p> : null}
      <div className={cn(title ? 'mt-1' : undefined, 'leading-relaxed')}>{children}</div>
    </div>
  );
}
