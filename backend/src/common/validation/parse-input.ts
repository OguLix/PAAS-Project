import type { z } from 'zod';
import { HttpError } from '../errors/http-error';

export function parseInput<TSchema extends z.ZodType>(
  schema: TSchema,
  input: unknown,
): z.infer<TSchema> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new HttpError(
      400,
      'VALIDATION_ERROR',
      'Request validation failed',
      parsed.error.issues.map((issue) => ({
        field: issue.path.length > 0 ? issue.path.join('.') : undefined,
        code: issue.code,
        message: issue.message,
      })),
    );
  }

  return parsed.data;
}
