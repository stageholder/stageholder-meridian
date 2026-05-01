import type { StageholderUser } from "@stageholder/sdk/core";
import { InternalServerErrorException } from "@nestjs/common";

/**
 * Meridian is a single-user app. Each Stageholder user has a personal org
 * auto-provisioned by the Hub; that's the org Meridian uses for
 * subscription/entitlement lookups. If a user somehow has no organizations
 * in their token claims, the Hub is misconfigured — fail loudly.
 */
export function getPersonalOrgId(user: StageholderUser): string {
  const orgs = user.organizations ?? [];
  if (orgs.length === 0) {
    throw new InternalServerErrorException(
      "User has no organizations. Hub should auto-provision a personal org on signup.",
    );
  }
  return orgs[0].id;
}
