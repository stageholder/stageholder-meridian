import type { Request } from "express";
import type { StageholderUser } from "@stageholder/auth";

/**
 * Incoming request after StageholderAuthGuard has run.
 * `user` is attached by the guard from the verified OIDC access token.
 */
export interface StageholderRequest extends Request {
  user: StageholderUser;
}
