import { redirect } from "next/navigation";
import { getSession } from "@stageholder/sdk/nextjs";
import { stageholder } from "@/lib/stageholder";
import { decodeAccessTokenClaims } from "@/lib/access-token-claims";
import { ChooseOrgForm } from "./_components/choose-org-form";

export const metadata = { title: "Choose your organization · Meridian" };

/**
 * Multi-org picker shown immediately after login (and reachable on demand).
 *
 * Server-side flow:
 *   1. Pull the sealed session via `getSession()`.
 *   2. Decode the access token's `organizations` claim — the canonical
 *      source. Hub keeps this OUT of the id_token to keep the cookie under
 *      4 KB, so a server decode is the cheapest way to read the list
 *      without an extra `/api/auth/me` round-trip.
 *   3. Branch:
 *        - 0 orgs → very rare (orphan session); send to login flow.
 *        - 1 org  → no choice to make; respect the requested `returnTo`.
 *        - 2+     → render the picker.
 *
 * The page is also reachable directly (header → "Switch organization"),
 * so it can't assume the user just landed from `afterCallback`. The
 * `returnTo` query param is optional; absent → home.
 */
export default async function ChooseOrgPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const sessionStore = await stageholder.sessionStore();
  const session = await getSession({ sessionStore });
  if (!session) redirect("/auth/login");

  const claims = decodeAccessTokenClaims(session.accessToken);
  const orgs = claims?.organizations ?? [];

  const params = await searchParams;
  const returnTo = isSafePath(params.returnTo) ? params.returnTo! : "/";

  if (orgs.length === 0) redirect("/auth/login");
  if (orgs.length === 1) redirect(returnTo);

  return (
    <ChooseOrgForm
      organizations={orgs}
      activeOrgId={session.activeOrgId}
      csrfToken={session.csrfToken}
      returnTo={returnTo}
      userName={session.name ?? session.email ?? ""}
    />
  );
}

/**
 * Open-redirect defense: only accept absolute-path-local targets. A safe
 * redirect must begin with `/` but must NOT begin with `//`, which the
 * browser would interpret as a protocol-relative URL.
 */
function isSafePath(path: string | undefined): boolean {
  if (!path) return false;
  return path.startsWith("/") && !path.startsWith("//");
}
