import { HttpException, HttpStatus } from "@nestjs/common";
import { getPlanForOrg } from "@stageholder/sdk/core";
import type { StageholderUser } from "@stageholder/sdk/core";
import { getPersonalOrgId } from "./personal-org";

const PRODUCT_SLUG = "meridian";

export type MeridianFeatureSlug =
  | "max_habits"
  | "max_todo_lists"
  | "max_active_todos";

/**
 * Free-tier limits. Used as the fallback when the user has no Meridian
 * subscription claim in their OIDC token — which happens on first sign-in
 * before the Hub has auto-assigned the `meridian-free` plan, or whenever
 * the Hub's subscription data is briefly missing. Without this fallback,
 * `getFeatureLimit` would return 0 and lock the user out of every write.
 *
 * Keep these in sync with the Hub's `plan_features` matrix for
 * `meridian-free`. The Hub is still the source of truth for paid plans;
 * these are strictly last-resort defaults that match the public pricing.
 */
const FREE_TIER_DEFAULTS: Record<MeridianFeatureSlug, number> = {
  max_habits: 5,
  max_todo_lists: 3,
  max_active_todos: 10,
};

/**
 * Resolve a numeric feature limit for the current user's Meridian plan.
 *
 * Returns `-1` for unlimited (enterprise or `meridian-unlimited`), else a
 * positive integer cap. Falls back to the free-tier default when the
 * token lacks a Meridian subscription claim (resilient to Hub not having
 * auto-created the free-plan row yet).
 */
export function getMeridianLimit(
  user: StageholderUser,
  feature: MeridianFeatureSlug,
): number {
  if (user.enterprise) return -1;

  const orgId = getPersonalOrgId(user);
  const sub = getPlanForOrg(user, orgId, PRODUCT_SLUG);
  if (!sub || !sub.features) {
    return FREE_TIER_DEFAULTS[feature];
  }

  const value = sub.features[feature];
  if (typeof value !== "number") return FREE_TIER_DEFAULTS[feature];
  return value; // -1 for unlimited, otherwise a positive cap
}

/**
 * Enforces a numeric limit for the current user's Meridian plan. Throws
 * 402 Payment Required with a structured body the client uses to render
 * the paywall modal. Unlimited plans (feature === -1) short-circuit.
 */
export async function enforceLimit(
  user: StageholderUser,
  feature: MeridianFeatureSlug,
  getCount: () => Promise<number>,
): Promise<void> {
  const limit = getMeridianLimit(user, feature);
  if (limit === -1) return;

  const current = await getCount();
  if (current < limit) return;

  throw new HttpException(
    {
      code: "limit_reached",
      feature,
      limit,
      current,
      message: `You've reached your limit of ${limit}. Upgrade for unlimited.`,
    },
    HttpStatus.PAYMENT_REQUIRED,
  );
}
