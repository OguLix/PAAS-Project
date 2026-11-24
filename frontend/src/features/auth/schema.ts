import { z } from 'zod';
import { emailSchema, passwordSchema } from '@ogulix/shared';

/**
 * Client-side auth schemas built on the shared Zod contract so email
 * normalization and password policy stay aligned with the API boundary.
 */
const clientEmailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .max(255, 'Email is too long')
  .refine((value) => emailSchema.safeParse(value).success, 'Enter a valid email address')
  .transform((value) => emailSchema.parse(value));

export const loginSchema = z.object({
  email: clientEmailSchema,
  password: z.string().min(1, 'Password is required').max(256, 'Password is too long'),
});

export const registerSchema = z
  .object({
    email: clientEmailSchema,
    password: z
      .string()
      .min(8, 'Use at least 8 characters')
      .max(256, 'Password is too long')
      .refine((value) => passwordSchema.safeParse(value).success, 'Use at least 8 characters'),
    confirmPassword: z.string().min(1, 'Repeat the password'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
