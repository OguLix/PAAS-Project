import { describe, expect, it } from 'vitest';
import {
  DEPLOYMENT_STATUSES,
  DEPLOYMENT_STATUS_LABELS,
  DEPLOYMENT_TRANSITIONS,
  NODE_COMMANDS,
  TERMINAL_DEPLOYMENT_STATUSES,
  canTransition,
  createApplicationInputSchema,
  isDeploymentStatus,
  isNodeCommand,
  repositoryUrlSchema,
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
