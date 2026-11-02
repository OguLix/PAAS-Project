import {
  DEPLOYMENT_STATUS_LABELS,
  type DeploymentStatus as DeploymentStatusValue,
} from '@ogulix/shared';
import { cn } from '@/lib/utils';

const statusStyles: Record<DeploymentStatusValue, string> = {
  QUEUED: 'border-warning/30 bg-warning-soft text-warning',
  PREPARING: 'border-warning/30 bg-warning-soft text-warning',
  BUILDING: 'border-warning/30 bg-warning-soft text-warning',
  STARTING: 'border-warning/30 bg-warning-soft text-warning',
  HEALTH_CHECKING: 'border-warning/30 bg-warning-soft text-warning',
  RUNNING: 'border-accent/30 bg-success-soft text-deep',
  STOPPING: 'border-warning/30 bg-warning-soft text-warning',
  STOPPED: 'border-line bg-subtle text-muted',
  FAILED: 'border-danger/30 bg-danger-soft text-danger',
  CANCELLED: 'border-line bg-subtle text-muted',
};

export function DeploymentStatus({ status }: { status: DeploymentStatusValue }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
        statusStyles[status],
      )}
    >
      {DEPLOYMENT_STATUS_LABELS[status]}
    </span>
  );
}
