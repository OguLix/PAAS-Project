const DEFAULT_REDACTION_PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  replacement: string | ((match: string, key: string) => string);
}> = [
  {
    pattern: /\bAuthorization\s*:\s*Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
    replacement: 'Authorization: Bearer [REDACTED]',
  },
  {
    pattern:
      /\b(password|passwd|secret|token|api[-_]?key|authorization|private[-_]?key)\b\s*[:=]\s*(?!Bearer\b)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
    replacement: (_match, key) => `${key}=[REDACTED]`,
  },
  {
    pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
    replacement: 'Bearer [REDACTED]',
  },
  {
    pattern: /\b(DATABASE_URL|REDIS_URL|ENV_ENCRYPTION_KEY)\s*=\s*\S+/gi,
    replacement: (_match, key) => `${key}=[REDACTED]`,
  },
  {
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    replacement: '[REDACTED PRIVATE KEY]',
  },
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Redact common credential shapes and exact secret values from a log line.
 * This is defence in depth: callers must still avoid logging secrets.
 */
export function redactText(value: string, extraSecrets: readonly string[] = []): string {
  let result = value;

  for (const secret of [...extraSecrets].filter(Boolean).sort((a, b) => b.length - a.length)) {
    result = result.replace(new RegExp(escapeRegExp(secret), 'g'), '[REDACTED]');
  }

  for (const { pattern, replacement } of DEFAULT_REDACTION_PATTERNS) {
    result =
      typeof replacement === 'string'
        ? result.replace(pattern, replacement)
        : result.replace(pattern, replacement);
  }

  return result;
}

/** Recursively redact strings in log metadata before serialisation. */
export function redactObject<T>(value: T, extraSecrets: readonly string[] = []): T {
  if (typeof value === 'string') {
    return redactText(value, extraSecrets) as T;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redactObject(entry, extraSecrets)) as T;
  }
  if (value instanceof Date) {
    return value;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        redactObject(entry, extraSecrets),
      ]),
    ) as T;
  }

  return value;
}
