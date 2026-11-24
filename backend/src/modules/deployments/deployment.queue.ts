import type { DeploymentJobPayload } from '@ogulix/shared';

export interface DeploymentQueueProducer {
  enqueue(payload: DeploymentJobPayload): Promise<void>;
  close?(): Promise<void>;
}
