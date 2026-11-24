import { repositoryUrlSchema, type BuildRequest, type BuildResult } from '@ogulix/shared';
import type { BuildkitAdapter } from '../adapters/buildkit.adapter';
import type { WorkerDeploymentContext } from '../repositories/deployment.repository';

const DEFAULT_BUILD_TIMEOUT_SECONDS = 600;

export class BuildService {
  constructor(private readonly buildkit: BuildkitAdapter) {}

  async build(
    targetHost: string,
    requestId: string,
    context: WorkerDeploymentContext,
  ): Promise<BuildResult> {
    // Repeat SSRF validation on the worker side before passing URLs to any builder.
    const parsedRepo = repositoryUrlSchema.safeParse(context.application.sourceRepository);
    if (!parsedRepo.success) {
      throw new Error('BUILD_FAILED');
    }

    const branch = context.branch ?? context.application.defaultBranch;
    const imageReference = `ogulix/${context.applicationId}:${context.id}`;

    const request: BuildRequest = {
      deploymentId: context.id,
      sourceRepository: parsedRepo.data,
      commitSha: context.commitSha,
      branch,
      dockerfilePath: context.application.dockerfilePath,
      buildContext: context.application.buildContext,
      imageReference,
      timeoutSeconds: DEFAULT_BUILD_TIMEOUT_SECONDS,
    };

    return this.buildkit.build(targetHost, requestId, request);
  }
}
