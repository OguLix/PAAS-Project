export class BuildkitAdapter {
  async build(_params: unknown): Promise<{ imageReference: string; imageDigest: string; durationSeconds: number }> {
    throw new Error('BuildKit adapter not implemented in scaffold');
  }
}
