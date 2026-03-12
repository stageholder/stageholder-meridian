import { z } from "zod";

const isProd = () => process.env.NODE_ENV === "production";

const envSchema = z.object({
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  JWT_SECRET: z
    .string()
    .min(
      isProd() ? 32 : 1,
      isProd()
        ? "JWT_SECRET must be at least 32 characters in production"
        : "JWT_SECRET is required",
    ),
  FRONTEND_URL: isProd()
    ? z.string().url("FRONTEND_URL must be a valid URL in production")
    : z.string().optional(),
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  INVITATION_EXPIRY_DAYS: z.coerce.number().int().positive().default(7),
});

export function validateEnv(): void {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Environment validation failed:\n${errors}`);
  }
}
