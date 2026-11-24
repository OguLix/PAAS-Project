export type TraefikRouteParams = {
  applicationId: string;
  hostnames: string[];
  targetHost: string;
  targetPort: number;
};

export interface TraefikRouteAdapter {
  writeRoute(params: TraefikRouteParams): Promise<void>;
  removeRoute(applicationId: string): Promise<void>;
}

/**
 * Local file-provider adapter boundary for Traefik on Server 1.
 * File generation for live Server 1 remains disabled until IAAS confirms the
 * Traefik dynamic directory and listener port.
 */
export class TraefikConfigAdapter implements TraefikRouteAdapter {
  async writeRoute(_params: TraefikRouteParams): Promise<void> {
    throw new Error('Traefik file-provider route writing is disabled until IAAS preflight passes');
  }

  async removeRoute(_applicationId: string): Promise<void> {
    throw new Error('Traefik file-provider route removal is disabled until IAAS preflight passes');
  }
}

export class MockTraefikConfigAdapter implements TraefikRouteAdapter {
  readonly routes = new Map<string, TraefikRouteParams>();

  async writeRoute(params: TraefikRouteParams): Promise<void> {
    this.routes.set(params.applicationId, params);
  }

  async removeRoute(applicationId: string): Promise<void> {
    this.routes.delete(applicationId);
  }
}
