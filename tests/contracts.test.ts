import { describe, expect, it } from 'vitest';
import {
  DEFAULT_APPLICATION_CONFIG,
  DEPLOYMENT_STATUSES,
  DEPLOYMENT_STATUS_LABELS,
  DEPLOYMENT_TRANSITIONS,
  NODE_COMMANDS,
  TERMINAL_DEPLOYMENT_STATUSES,
  applicationDeploymentConfigSchema,
  canTransition,
  createApplicationInputSchema,
  createDomainInputSchema,
  deployInputSchema,
  deploymentJobPayloadSchema,
  environmentVariableKeySchema,
  isDeploymentStatus,
  isNodeCommand,
  loginInputSchema,
  repositoryUrlSchema,
  registerInputSchema,
} from '@ogulix/shared';

describe('deployment status contract', () => {
  it('contains exactly the ten documented statuses', () => {
    expect(DEPLOYMENT_STATUSES).toHaveLength(10);
    expect([...DEPLOYMENT_STATUSES]).toEqual([
      'QUEUED',
      'PREPARING',
      'BUILDING',
      'STARTING',
      'HEALTH_CHECKING',
      'RUNNING',
      'STOPPING',
      'STOPPED',
      'FAILED',
      'CANCELLED',
    ]);
  });

  it('does not accept the withdrawn status labels', () => {
    expect(isDeploymentStatus('DEPLOYING')).toBe(false);
    expect(isDeploymentStatus('SUCCEEDED')).toBe(false);
    expect(isDeploymentStatus('RUNNING')).toBe(true);
  });

  it('has a non-empty label for every status', () => {
    for (const status of DEPLOYMENT_STATUSES) {
      expect(DEPLOYMENT_STATUS_LABELS[status].length).toBeGreaterThan(0);
    }
  });

  it('only references known statuses in the transition map', () => {
    for (const [from, targets] of Object.entries(DEPLOYMENT_TRANSITIONS)) {
      expect(isDeploymentStatus(from)).toBe(true);
      for (const target of targets) {
        expect(isDeploymentStatus(target)).toBe(true);
      }
    }
  });

  it('allows the documented happy path and blocks shortcuts', () => {
    expect(canTransition('QUEUED', 'PREPARING')).toBe(true);
    expect(canTransition('HEALTH_CHECKING', 'RUNNING')).toBe(true);
    expect(canTransition('QUEUED', 'RUNNING')).toBe(false);
    expect(canTransition('RUNNING', 'CANCELLED')).toBe(false);
  });

  it('keeps terminal statuses out of the build pipeline', () => {
    for (const status of TERMINAL_DEPLOYMENT_STATUSES) {
      for (const target of DEPLOYMENT_TRANSITIONS[status]) {
        // RUNNING may only move to STOPPING; no terminal status may re-enter
        // the build pipeline without a new deployment attempt.
        expect(target).toBe('STOPPING');
      }
    }

    expect([...DEPLOYMENT_TRANSITIONS.RUNNING]).toEqual(['STOPPING']);
    expect(DEPLOYMENT_TRANSITIONS.STOPPED).toHaveLength(0);
    expect(DEPLOYMENT_TRANSITIONS.FAILED).toHaveLength(0);
    expect(DEPLOYMENT_TRANSITIONS.CANCELLED).toHaveLength(0);
  });
});

describe('repository URL validation', () => {
  it('accepts a public https repository', () => {
    expect(repositoryUrlSchema.safeParse('https://github.com/ogulix/demo.git').success).toBe(true);
  });

  it('rejects non-https schemes', () => {
    expect(repositoryUrlSchema.safeParse('http://github.com/ogulix/demo.git').success).toBe(false);
    expect(repositoryUrlSchema.safeParse('ssh://git@github.com/ogulix/demo.git').success).toBe(
      false,
    );
    expect(repositoryUrlSchema.safeParse('git://github.com/ogulix/demo.git').success).toBe(false);
  });

  it('rejects credentials embedded in the URL', () => {
    expect(
      repositoryUrlSchema.safeParse('https://user:secret@github.com/ogulix/demo.git').success,
    ).toBe(false);
  });
  it('rejects an empty user-info delimiter in a repository URL', () => {
    expect(repositoryUrlSchema.safeParse('https://@github.com/ogulix/demo.git').success).toBe(
      false,
    );
  });

  it('rejects private, loopback and link-local hosts', () => {
    for (const url of [
      'https://localhost/repo.git',
      'https://127.0.0.1/repo.git',
      'https://10.0.0.5/repo.git',
      'https://172.16.1.4/repo.git',
      'https://192.168.174.145/repo.git',
      'https://169.254.169.254/latest/meta-data',
      'https://[::1]/repo.git',
      'https://[fd00::1]/repo.git',
      'https://metadata.google.internal/repo.git',
      'https://git.internal/repo.git',
    ]) {
      expect(repositoryUrlSchema.safeParse(url).success, url).toBe(false);
    }
  });

  it('rejects non-default HTTPS ports and non-qualified hosts', () => {
    expect(repositoryUrlSchema.safeParse('https://github.com:8443/ogulix/demo.git').success).toBe(
      false,
    );
    expect(repositoryUrlSchema.safeParse('https://intranet/ogulix/demo.git').success).toBe(false);
    expect(repositoryUrlSchema.safeParse('https://github.com:443/ogulix/demo.git').success).toBe(
      true,
    );
  });
});

describe('application input contract', () => {
  it('accepts a well-formed create request', () => {
    const parsed = createApplicationInputSchema.safeParse({
      name: 'demo',
      sourceRepository: 'https://github.com/ogulix/demo.git',
      defaultBranch: 'main',
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects an empty name', () => {
    const parsed = createApplicationInputSchema.safeParse({
      name: '   ',
      sourceRepository: 'https://github.com/ogulix/demo.git',
      defaultBranch: 'main',
    });

    expect(parsed.success).toBe(false);
  });

  it('accepts optional deployment configuration and validates resource limits', () => {
    const parsed = createApplicationInputSchema.safeParse({
      name: 'demo',
      sourceRepository: 'https://github.com/ogulix/demo.git',
      defaultBranch: 'main',
      dockerfilePath: 'docker/Dockerfile',
      buildContext: 'apps/web',
      internalPort: 8080,
      healthCheckPath: '/health',
      cpuCores: 0.75,
      memoryMb: 768,
      pidsLimit: 128,
    });

    expect(parsed.success).toBe(true);
    expect(applicationDeploymentConfigSchema.parse(DEFAULT_APPLICATION_CONFIG)).toEqual(
      DEFAULT_APPLICATION_CONFIG,
    );
  });

  it('rejects path traversal and unsafe deployment configuration', () => {
    const base = {
      name: 'demo',
      sourceRepository: 'https://github.com/ogulix/demo.git',
      defaultBranch: 'main',
    };

    expect(
      createApplicationInputSchema.safeParse({ ...base, dockerfilePath: '../Dockerfile' }).success,
    ).toBe(false);
    expect(createApplicationInputSchema.safeParse({ ...base, buildContext: '/etc' }).success).toBe(
      false,
    );
    expect(
      createApplicationInputSchema.safeParse({ ...base, healthCheckPath: 'health' }).success,
    ).toBe(false);
    expect(createApplicationInputSchema.safeParse({ ...base, memoryMb: 32 }).success).toBe(false);
  });

  it('rejects unknown fields and unsafe branch names', () => {
    expect(
      createApplicationInputSchema.safeParse({
        name: 'demo',
        sourceRepository: 'https://github.com/ogulix/demo.git',
        defaultBranch: 'main',
        unexpected: true,
      }).success,
    ).toBe(false);
    expect(deployInputSchema.safeParse({ branch: 'feature/../main' }).success).toBe(false);
    expect(deployInputSchema.safeParse({ branch: 'feature/new-ui' }).success).toBe(true);
  });
});

describe('authentication and domain input contracts', () => {
  it('normalizes email casing and enforces the password length policy', () => {
    expect(
      registerInputSchema.parse({ email: '  USER@Example.test ', password: 'password8' }),
    ).toEqual({ email: 'user@example.test', password: 'password8' });
    expect(loginInputSchema.safeParse({ email: 'user@example.test', password: '' }).success).toBe(
      false,
    );
    expect(
      registerInputSchema.safeParse({ email: 'user@example.test', password: 'short' }).success,
    ).toBe(false);
  });

  it('accepts only a single hostname below apps.ogulix.tech', () => {
    expect(createDomainInputSchema.parse({ hostname: 'DEMO.apps.ogulix.tech' })).toEqual({
      hostname: 'demo.apps.ogulix.tech',
    });
    expect(createDomainInputSchema.safeParse({ hostname: 'example.com' }).success).toBe(false);
    expect(
      createDomainInputSchema.safeParse({ hostname: 'nested.demo.apps.ogulix.tech' }).success,
    ).toBe(false);
  });
});

describe('runtime node protocol contract', () => {
  it('exposes only the documented verbs', () => {
    expect([...NODE_COMMANDS]).toEqual([
      'node-info',
      'build',
      'container-upsert',
      'container-start',
      'container-stop',
      'container-inspect',
      'container-remove',
      'logs',
      'cleanup',
    ]);
  });

  it('has no shell or exec verb', () => {
    expect(isNodeCommand('shell')).toBe(false);
    expect(isNodeCommand('exec')).toBe(false);
  });
});

describe('environment and queue contracts', () => {
  it('reserves platform-managed environment variable names', () => {
    for (const key of ['PATH', 'PORT', 'NODE_OPTIONS', 'OGULIX_SECRET']) {
      expect(environmentVariableKeySchema.safeParse(key).success, key).toBe(false);
    }
    expect(environmentVariableKeySchema.safeParse('DATABASE_PASSWORD').success).toBe(true);
  });

  it('requires a discriminated deployment job kind', () => {
    const base = {
      deploymentId: 'dep_1',
      applicationId: 'app_1',
      requestedByUserId: 'user_1',
      kind: 'deploy',
    };
    expect(deploymentJobPayloadSchema.safeParse(base).success).toBe(true);
    expect(deploymentJobPayloadSchema.safeParse({ ...base, kind: undefined }).success).toBe(false);
    expect(
      deploymentJobPayloadSchema.safeParse({ ...base, kind: 'shell', command: 'rm -rf /' }).success,
    ).toBe(false);
  });
});
