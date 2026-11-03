export class TraefikConfigAdapter {
  async writeRoute(_params: unknown): Promise<void> {
    throw new Error('Traefik config adapter not implemented in scaffold');
  }

  async removeRoute(_applicationId: string): Promise<void> {
    throw new Error('Traefik config adapter not implemented in scaffold');
  }
}
