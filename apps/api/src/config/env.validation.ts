import { z } from "zod";

const isProd = () => process.env.NODE_ENV === "production";

const envSchema = z.object({
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  IDENTITY_ISSUER_URL: z
    .string()
    .url("IDENTITY_ISSUER_URL must be a valid URL")
    .min(1, "IDENTITY_ISSUER_URL is required"),
  IDENTITY_CLIENT_ID: z.string().min(1, "IDENTITY_CLIENT_ID is required"),
  IDENTITY_CLIENT_SECRET: isProd()
    ? z.string().min(1, "IDENTITY_CLIENT_SECRET is required in production")
    : z.string().optional(),
  FRONTEND_URL: isProd()
    ? z.string().url("FRONTEND_URL must be a valid URL in production")
    : z.string().optional(),
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  ENCRYPTION_KEY: isProd()
    ? z
        .string()
        .min(32, "ENCRYPTION_KEY must be at least 32 characters in production")
    : z.string().optional(),
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
