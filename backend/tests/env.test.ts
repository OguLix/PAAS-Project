import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/env';

describe('backend environment', () => {
  it('defaults to mock runtime mode and closed registration', () => {
    const env = loadEnv({ NODE_ENV: 'test' });

    expect(env.RUNTIME_MODE).toBe('mock');
    expect(env.REGISTRATION_MODE).toBe('closed');
  });

  it('rejects an encryption key that is not 32 base64 bytes', () => {
    expect(() =>
      loadEnv({
        NODE_ENV: 'test',
        ENV_ENCRYPTION_KEY: 'too-short',
      }),
    ).toThrow(/ENV_ENCRYPTION_KEY/);
  });

  it('accepts a valid 32-byte encryption key', () => {
    const env = loadEnv({
      NODE_ENV: 'test',
      ENV_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
    });

    expect(env.ENV_ENCRYPTION_KEY).toBeDefined();
  });
});
