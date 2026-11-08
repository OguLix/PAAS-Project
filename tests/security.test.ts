import { describe, expect, it } from 'vitest';
import {
  InvalidDeploymentTransitionError,
  assertDeploymentTransition,
  decryptSecret,
  encryptSecret,
  generateEncryptionKey,
  parseEncryptionKey,
  redactObject,
  redactText,
} from '@ogulix/shared/server';

describe('secret encryption', () => {
  it('round-trips a secret with AES-256-GCM', () => {
    const key = generateEncryptionKey();
    const encrypted = encryptSecret('super-secret-value', key);

    expect(encrypted.startsWith('v1:')).toBe(true);
    expect(encrypted).not.toContain('super-secret-value');
    expect(decryptSecret(encrypted, key)).toBe('super-secret-value');
  });

  it('rejects tampered ciphertext and the wrong key', () => {
    const key = generateEncryptionKey();
    const encrypted = encryptSecret('value', key);
    const parts = encrypted.split(':');
    parts[2] = `${parts[2]!.startsWith('A') ? 'B' : 'A'}${parts[2]!.slice(1)}`;

    expect(() => decryptSecret(parts.join(':'), key)).toThrow();
    expect(() => decryptSecret(encrypted, generateEncryptionKey())).toThrow();
  });

  it('rejects keys that are not exactly 32 base64 bytes', () => {
    expect(() => parseEncryptionKey('not-a-key')).toThrow();
    expect(() => parseEncryptionKey(Buffer.alloc(16).toString('base64'))).toThrow();
    expect(parseEncryptionKey(generateEncryptionKey())).toHaveLength(32);
  });
});

describe('log redaction', () => {
  it('redacts common credential shapes and exact secret values', () => {
    const line = 'password=hunter2 token: abc123 Authorization: Bearer eyJhbGciOi.secret';
    const redacted = redactText(line, ['abc123']);

    expect(redacted).not.toContain('hunter2');
    expect(redacted).not.toContain('abc123');
    expect(redacted).not.toContain('eyJhbGciOi.secret');
    expect(redacted).toContain('[REDACTED]');
  });

  it('redacts nested metadata without mutating the input', () => {
    const metadata = {
      requestId: 'req_1',
      databaseUrl: 'DATABASE_URL=mysql://user:pass@localhost/db',
      nested: ['REDIS_URL=redis://localhost:6379', 'secret=value'],
    };
    const redacted = redactObject(metadata);

    expect(redacted.databaseUrl).not.toContain('pass');
    expect(redacted.nested[0]).not.toContain('localhost');
    expect(redacted.nested[1]).not.toContain('value');
    expect(metadata.databaseUrl).toContain('pass');
  });
});

describe('deployment state guard', () => {
  it('allows documented transitions', () => {
    expect(() => assertDeploymentTransition('QUEUED', 'PREPARING')).not.toThrow();
    expect(() => assertDeploymentTransition('HEALTH_CHECKING', 'RUNNING')).not.toThrow();
  });

  it('rejects shortcuts and re-opening terminal deployments', () => {
    expect(() => assertDeploymentTransition('QUEUED', 'RUNNING')).toThrow(
      InvalidDeploymentTransitionError,
    );
    expect(() => assertDeploymentTransition('FAILED', 'PREPARING')).toThrow(
      InvalidDeploymentTransitionError,
    );
  });
});
