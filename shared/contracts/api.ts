import { z } from 'zod';

/** Query/param schemas for endpoints defined in docs/design/api-contract.md. */

export const opaqueIdSchema = z.string().min(1).max(64);

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const logQuerySchema = z.object({
  after: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});
