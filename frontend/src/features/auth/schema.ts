import { z } from 'zod';

/**
 * Client-side schemas for the authentication forms. They exist for UX only:
 * the API validates again and remains authoritative (api-contract.md section 5).
 *
 * The minimum password length is a frontend usability hint, not a contract
 * value. Backend 1 owns the real policy.
 */

const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .max(255, 'Email is too long')
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email address');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(256, 'Password is too long'),
});

export const registerSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(8, 'Use at least 8 characters').max(256, 'Password is too long'),
    confirmPassword: z.string().min(1, 'Repeat the password'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
