export class DockerAdapter {
  async upsertContainer(_spec: unknown): Promise<void> {
    throw new Error('Docker adapter not implemented in scaffold');
  }

  async startContainer(_name: string): Promise<void> {
    throw new Error('Docker adapter not implemented in scaffold');
  }

  async stopContainer(_name: string): Promise<void> {
    throw new Error('Docker adapter not implemented in scaffold');
  }

  async removeContainer(_name: string): Promise<void> {
    throw new Error('Docker adapter not implemented in scaffold');
  }

  async inspectContainer(_name: string): Promise<unknown> {
    throw new Error('Docker adapter not implemented in scaffold');
  }
}
