import { Skeleton } from '@/components/ui/skeleton';

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-5 w-44" />
      <Skeleton className="h-4 w-full max-w-md" />
      <Skeleton className="h-4 w-full max-w-sm" />
    </div>
  );
}
