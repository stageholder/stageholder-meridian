import { z } from 'zod';

export const RegisterDto = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required').max(100),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
export type RegisterDto = z.infer<typeof RegisterDto>;

export const LoginDto = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginDto = z.infer<typeof LoginDto>;

export const SocialLoginDto = z.object({
  provider: z.literal('google'),
  idToken: z.string().min(1, 'ID token is required'),
});
export type SocialLoginDto = z.infer<typeof SocialLoginDto>;
