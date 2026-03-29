import { z } from "zod";

const timezoneSchema = z
  .string()
  .max(100)
  .refine(
    (tz) => {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    },
    { message: "Invalid IANA timezone" },
  );

export const RegisterDto = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(1, "Name is required").max(100),
  password: z.string().min(8, "Password must be at least 8 characters"),
  timezone: timezoneSchema.optional(),
});
export type RegisterDto = z.infer<typeof RegisterDto>;

export const LoginDto = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});
export type LoginDto = z.infer<typeof LoginDto>;

export const SocialLoginDto = z
  .object({
    provider: z.literal("google"),
    idToken: z.string().optional(),
    accessToken: z.string().optional(),
  })
  .refine((data) => data.idToken || data.accessToken, {
    message: "Either idToken or accessToken is required",
  });
export type SocialLoginDto = z.infer<typeof SocialLoginDto>;

export const RefreshDto = z.object({
  refreshToken: z.string().optional(),
});
export type RefreshDto = z.infer<typeof RefreshDto>;

export const UpdateProfileDto = z.object({
  name: z.string().min(1).max(100).optional(),
  avatar: z.string().url().optional(),
  timezone: timezoneSchema.optional(),
});
export type UpdateProfileDto = z.infer<typeof UpdateProfileDto>;
