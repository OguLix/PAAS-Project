import type { RuntimeMode } from '@ogulix/shared';

export type HealthCheckTarget = {
  host: string;
  port: number;
  path: string;
};

export interface HealthChecker {
  check(target: HealthCheckTarget): Promise<boolean>;
}

export class HealthCheckService implements HealthChecker {
  constructor(private readonly runtimeMode: RuntimeMode = 'mock') {}

  async check(target: HealthCheckTarget): Promise<boolean> {
    if (this.runtimeMode === 'mock') {
      return Boolean(target.host && target.port >= 30000 && target.path.startsWith('/'));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(`http://${target.host}:${target.port}${target.path}`, {
        method: 'GET',
        signal: controller.signal,
      });
      return response.status >= 200 && response.status < 400;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
}
