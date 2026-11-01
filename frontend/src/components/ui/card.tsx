import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Border-only panels. The direction asks for minimal shadows, so elevation is
 * expressed with a border and background, not with depth.
 */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn('rounded-panel border border-line bg-white', className)}>
      {children}
    </section>
  );
}

export function CardHeader({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('flex flex-col gap-1 px-6 pt-6', className)}>{children}</div>;
}

export function CardTitle({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <h2 className={cn('font-display text-lg font-semibold text-ink', className)}>{children}</h2>
  );
}

export function CardDescription({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <p className={cn('text-sm leading-relaxed text-muted', className)}>{children}</p>;
}

export function CardContent({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('px-6 py-6', className)}>{children}</div>;
}
