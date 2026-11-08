import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Server-only secret encryption. Never import this module from the browser
 * bundle; expose it only through `@ogulix/shared/server/*`.
 */
export const ENCRYPTION_KEY_BYTES = 32;
export const ENCRYPTION_VERSION = 'v1';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

export function parseEncryptionKey(encoded: string): Buffer {
  const value = encoded.trim();
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(value)) {
    throw new Error('ENV_ENCRYPTION_KEY must be base64-encoded 32 random bytes');
  }

  const key = Buffer.from(value, 'base64');
  if (key.length !== ENCRYPTION_KEY_BYTES) {
    throw new Error('ENV_ENCRYPTION_KEY must decode to exactly 32 bytes');
  }

  return key;
}

export function generateEncryptionKey(): string {
  return randomBytes(ENCRYPTION_KEY_BYTES).toString('base64');
}

function keyBuffer(key: Buffer | string): Buffer {
  return typeof key === 'string' ? parseEncryptionKey(key) : key;
}

export function encryptSecret(plaintext: string, key: Buffer | string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', keyBuffer(key), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTION_VERSION,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':');
}

export function decryptSecret(payload: string, key: Buffer | string): string {
  const parts = payload.split(':');
  if (parts.length !== 4) {
    throw new Error('Encrypted value has an unsupported format');
  }

  const [version, ivPart, tagPart, ciphertextPart] = parts;
  if (version !== ENCRYPTION_VERSION || !ivPart || !tagPart || ciphertextPart === undefined) {
    throw new Error('Encrypted value has an unsupported version or missing fields');
  }

  const iv = Buffer.from(ivPart, 'base64url');
  const authTag = Buffer.from(tagPart, 'base64url');
  if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
    throw new Error('Encrypted value has invalid IV or authentication tag');
  }

  const decipher = createDecipheriv('aes-256-gcm', keyBuffer(key), iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, 'base64url')),
    decipher.final(),
  ]);

  return plaintext.toString('utf8');
}
