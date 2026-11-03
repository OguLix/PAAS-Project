export class HealthCheckService {
  async check(_target: unknown): Promise<boolean> {
    throw new Error('Health check service not implemented in scaffold');
  }
}
