import { DEPLOYMENT_STATUSES } from '@ogulix/shared';

export class DeploymentOrchestrator {
  getAllowedStatuses(): readonly string[] {
    return DEPLOYMENT_STATUSES;
  }

  async executeDeploy(_payload: unknown): Promise<void> {
    throw new Error('Deployment orchestrator not implemented in scaffold');
  }

  async executeStop(_payload: unknown): Promise<void> {
    throw new Error('Deployment orchestrator not implemented in scaffold');
  }

  async executeRestart(_payload: unknown): Promise<void> {
    throw new Error('Deployment orchestrator not implemented in scaffold');
  }
}
