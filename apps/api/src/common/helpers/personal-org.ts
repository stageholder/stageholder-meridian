import type { OrgMembership, StageholderUser } from "@stageholder/sdk/core";
import { getPersonalOrg } from "@stageholder/sdk/core";
import { InternalServerErrorException } from "@nestjs/common";

/**
 * Meridian is a single-user app. Each Stageholder user has a personal org
 * auto-provisioned by the Hub; that's the org Meridian uses for
 * subscription/entitlement lookups. Prefer the explicit `kind: "personal"`
 * membership when the Hub emits it; fall back to `organizations[0]` for
 * older Hub deployments that don't yet emit `kind` (per SDK guidance). If
 * the user has no organizations at all, the Hub is misconfigured — fail
 * loudly.
 */
export function getPersonalOrgMembership(user: StageholderUser): OrgMembership {
  const personal = getPersonalOrg(user);
  if (personal) return personal;
  const fallback = user.organizations?.[0];
  if (fallback) return fallback;
  throw new InternalServerErrorException(
    "User has no organizations. Hub should auto-provision a personal org on signup.",
  );
}

export function getPersonalOrgId(user: StageholderUser): string {
  return getPersonalOrgMembership(user).id;
}
