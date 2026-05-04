"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Sparkles } from "lucide-react";
import {
  RefreshSessionError,
  useCheckoutStatus,
  useRefreshSession,
  useStageholder,
  useSubscription,
} from "@stageholder/sdk/react";
import { refreshEntitlement } from "@/lib/entitlement";
import { tryGetCurrentUserSub } from "@/lib/current-user-sub";
import { cn } from "@/lib/utils";

/**
 * Post-billing-action landing page. Two entry modes:
 *
 * - **Checkout success** (Polar redirects with `?checkout_id=...`): poll
 *   Polar through Hub's passthrough until it confirms `succeeded`, THEN
 *   rotate the session and bust caches.
 * - **Plan change success** (Hub's change-plan handler redirects with
 *   `?changed=1`): no Polar polling — Hub already issued the
 *   `subscriptions.update` call before redirecting, and we trust its
 *   `subscription.updated` webhook will land within the
 *   refreshSession round-trip. Skip straight to rotate + bust.
 *
 * Both modes share the post-conditions (rotate access token, bust
 * entitlement + React Query caches) so they share this page rather than
 * forking into a parallel "/billing/changed" route — one mental model,
 * two entry points.
 *
 * Three-step landing sequence (checkout mode) — order matters:
 *
 * 1. **Poll Hub's Polar passthrough** (`useCheckoutStatus`) until Polar
 *    itself confirms `status: "succeeded"`. This bypasses the local DB so
 *    we never refresh the session before the `subscription.created` webhook
 *    has landed — without this, the user can pay and still see "Free" on
 *    the next page (the original race that motivated this whole flow).
 * 2. **Rotate the access token** (`refreshSession`) so the new
 *    `subscriptions` claim lands in the BFF session.
 * 3. **Bust cached billing data** (Dexie entitlement + React Query) so
 *    every consumer that depends on plan data picks up the new value
 *    without waiting for a stale-time tick.
 */
type Phase =
  | "polling"
  | "refreshing"
  | "ready"
  | "pending"
  | "session_expired"
  | "checkout_failed"
  | "timeout";

export default function BillingSuccessPage() {
  const searchParams = useSearchParams();
  const checkoutId = searchParams.get("checkout_id");
  // `?changed=1` signals a plan-change return path (no Polar checkout was
  // involved). Set by Hub's change-plan handler, consumed by the effect
  // below to skip polling and go straight to refresh+bust.
  const isChangePlan = searchParams.get("changed") === "1";
  const refreshSession = useRefreshSession();
  const { signOut } = useStageholder();
  const queryClient = useQueryClient();
  const sub = useSubscription();
  // Skip the polling phase for plan-change mode — there's no Polar checkout
  // to wait on, the row was updated server-side before we got redirected.
  const [phase, setPhase] = useState<Phase>(
    isChangePlan ? "refreshing" : "polling",
  );

  // Pass `null` in plan-change mode so useCheckoutStatus stays idle; we
  // only want it driving the state machine for the checkout entry path.
  const checkout = useCheckoutStatus({
    checkoutId: isChangePlan ? null : checkoutId,
  });

  useEffect(() => {
    let cancelled = false;

    /**
     * Bust the React Query billing caches AND Meridian's local Dexie
     * entitlement cache. Done independent of refreshSession because these
     * caches are local-only — they need busting whether or not the session
     * could be refreshed against Hub.
     */
    async function bustCaches() {
      const userSub = tryGetCurrentUserSub();
      if (userSub) {
        await refreshEntitlement(userSub);
      }
      await queryClient.invalidateQueries({
        predicate: (q) => {
          const key = q.queryKey;
          if (!Array.isArray(key)) return false;
          const head = key[0];
          return (
            head === "billing" ||
            head === "invoices" ||
            head === "subscriptions" ||
            head === "entitlement"
          );
        },
      });
    }

    /**
     * Run refreshSession + cache busting. Branches the recovery message
     * based on WHY refreshSession failed:
     *
     * - 401 → session genuinely dead (refresh_token rejected). Must re-auth.
     * - other → transient (CSRF mismatch, 5xx, network). Claims stay stale
     *   on this device for ~15 min until the access token's natural expiry
     *   triggers a server-side refresh through fetchWithAuth on the next
     *   API call. Show "pending" with a sign-out-to-fix-now option, but
     *   don't force re-auth — most users will tolerate a few minutes of
     *   delay better than re-entering credentials right after paying.
     */
    async function runRecovery(timeoutMode: boolean) {
      try {
        await Promise.all([refreshSession(), bustCaches()]);
        if (!cancelled) setPhase(timeoutMode ? "timeout" : "ready");
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[meridian/billing/success] recovery failed:", err);
        // Still bust the local caches even if Hub-side refresh failed —
        // the next /auth/me poll will pick up new claims, and the entitlement
        // cache shouldn't keep serving the pre-purchase plan in the meantime.
        try {
          await bustCaches();
        } catch {
          // ignore — local cache failures are non-fatal
        }
        if (cancelled) return;
        if (err instanceof RefreshSessionError && err.status === 401) {
          setPhase("session_expired");
        } else {
          setPhase("pending");
        }
      }
    }

    void (async () => {
      // Plan-change path skips Polar polling entirely — Hub already called
      // `subscriptions.update` before redirecting us here, so the only work
      // left is rotating the session and busting caches. Run recovery
      // immediately rather than waiting on a `checkout.phase` transition
      // that will never come (checkoutId is null in this mode).
      if (isChangePlan) {
        await runRecovery(false);
        return;
      }
      if (checkout.phase === "polling" || checkout.phase === "idle") return;
      if (checkout.phase === "succeeded") {
        setPhase("refreshing");
        await runRecovery(false);
        return;
      }
      if (checkout.phase === "failed" || checkout.phase === "error") {
        if (!cancelled) setPhase("checkout_failed");
        return;
      }
      if (checkout.phase === "timeout") {
        // Polar didn't reach a terminal state in 15s. Optimistically refresh
        // anyway — the webhook may still arrive — and surface a soft warning.
        await runRecovery(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isChangePlan, checkout.phase, refreshSession, queryClient]);

  /**
   * Sign-out fast path: when the session is in the "stale claims, dead
   * refresh_token" state, signing out and back in is the only way to see
   * the new plan immediately. Wired here rather than as a plain link so
   * the SDK's CSRF-protected sign-out fires correctly + cross-tab logout
   * BroadcastChannel runs, instead of just navigating to /auth/login.
   */
  async function handleSignOutAndReauth() {
    try {
      await signOut();
    } catch {
      // Even if the BFF logout call fails, navigate to login — the worst
      // case is the user clicks "Sign in" once more on the next page.
      window.location.href = "/auth/login";
    }
  }

  // Copy switches between checkout entry ("payment confirmed", "purchase")
  // and plan-change entry ("plan updated", "switch") — the same phases drive
  // both, but the framing has to match the user's mental model so a trial
  // user who clicked "Switch to Conduct" doesn't see "your purchase is
  // confirmed" and wonder if they were charged.
  const headline = (() => {
    if (phase === "polling")
      return checkout.phase === "polling" && checkout.data?.status
        ? `Confirming with Polar…`
        : "Confirming your payment…";
    if (phase === "refreshing")
      return isChangePlan ? "Switching your plan…" : "Refreshing your access…";
    if (phase === "ready")
      return sub?.planName
        ? `You're on ${sub.planName}.`
        : isChangePlan
          ? "Your new plan is live."
          : "Your new plan is live.";
    if (phase === "timeout")
      return "Almost there — your plan should appear shortly.";
    if (phase === "pending")
      return isChangePlan
        ? "Your plan change is confirmed."
        : "Your purchase is confirmed.";
    if (phase === "session_expired")
      return "Sign in again to see your new plan.";
    return "Your checkout didn't complete.";
  })();

  const body = (() => {
    if (phase === "polling")
      return "Waiting for Polar to mark your checkout complete. This usually takes a couple of seconds.";
    if (phase === "refreshing")
      return isChangePlan
        ? "We've asked Polar to swap your subscription onto the new plan. Rotating your session and busting caches so every limit reflects the change."
        : "Polar confirmed your purchase. Updating your subscription claim and entitlement cache so every limit reflects your new plan.";
    if (phase === "ready")
      return isChangePlan
        ? "Your subscription is now on the new plan. Every limit and gated feature is updated across this device."
        : "Your subscription is active. Every limit and gated feature is now updated across this device.";
    if (phase === "timeout")
      return "Polar took longer than usual to confirm. Your purchase is being processed in the background — refresh this page in a minute, or check Billing for the live status.";
    if (phase === "pending")
      return isChangePlan
        ? "Polar accepted the plan change, but we couldn't refresh your session in this tab. Your new plan will be applied automatically within a few minutes — or sign out and back in to see it immediately."
        : "Polar accepted your payment, but we couldn't refresh your session in this tab. Your new plan will be applied automatically within a few minutes — or sign out and back in to see it immediately.";
    if (phase === "session_expired")
      return isChangePlan
        ? "Polar accepted the plan change, but your session expired before we could update it. Sign in again to pick up your new plan."
        : "Polar accepted your payment, but your session expired before we could update it. Sign in again to pick up your new plan.";
    return "Polar reported the checkout as failed or expired. No charge was made — try again from the upgrade page.";
  })();

  const kicker = (() => {
    if (phase === "polling") return "Confirming payment";
    if (phase === "refreshing")
      return isChangePlan ? "Updating your plan" : "Activating your plan";
    if (phase === "ready")
      return isChangePlan ? "Plan updated" : "Welcome aboard";
    if (phase === "timeout") return "Still processing";
    if (phase === "pending") return "Plan updating";
    if (phase === "session_expired") return "Sign in to continue";
    return "Checkout incomplete";
  })();

  return (
    <div className="relative min-h-screen bg-background">
      <div className="relative z-10 mx-auto max-w-2xl px-4 py-16 md:py-24">
        <div className="rounded-[32px] border border-border/70 bg-card/80 p-10 md:p-14 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Sparkles
              className={cn(
                "size-4",
                phase === "ready"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : phase === "session_expired" || phase === "checkout_failed"
                    ? "text-rose-600 dark:text-rose-400"
                    : phase === "pending" || phase === "timeout"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-foreground/60",
              )}
            />
            <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-foreground/55">
              {kicker}
            </p>
          </div>

          <h1
            className="mt-5 text-[clamp(2.25rem,6vw,4rem)] leading-[0.95] tracking-[-0.02em]"
            style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
          >
            {headline}
          </h1>

          <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
            {body}
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            {(phase === "ready" ||
              phase === "timeout" ||
              phase === "pending") && (
              <Link
                href="/app/settings/billing"
                className={cn(
                  "group/btn inline-flex h-12 items-center gap-2 rounded-full bg-foreground pl-5 pr-1.5 text-sm font-medium text-background",
                  "transition-opacity hover:opacity-90",
                )}
              >
                View billing
                <span className="inline-flex size-9 items-center justify-center rounded-full bg-background/15 transition-transform group-hover/btn:translate-x-0.5">
                  <ArrowRight className="size-3.5" strokeWidth={2} />
                </span>
              </Link>
            )}
            {phase === "ready" && (
              <Link
                href="/app"
                className="inline-flex h-12 items-center rounded-full border border-foreground/80 bg-background px-5 text-sm font-medium text-foreground transition-colors hover:bg-foreground hover:text-background"
              >
                Back to dashboard
              </Link>
            )}
            {phase === "pending" && (
              <button
                type="button"
                onClick={() => void handleSignOutAndReauth()}
                className="inline-flex h-12 items-center rounded-full border border-foreground/80 bg-background px-5 text-sm font-medium text-foreground transition-colors hover:bg-foreground hover:text-background"
              >
                Sign out & back in
              </button>
            )}
            {phase === "session_expired" && (
              <button
                type="button"
                onClick={() => void handleSignOutAndReauth()}
                className={cn(
                  "inline-flex h-12 items-center rounded-full bg-foreground px-5 text-sm font-medium text-background",
                  "transition-opacity hover:opacity-90",
                )}
              >
                Sign in again
              </button>
            )}
            {phase === "checkout_failed" && (
              <Link
                href="/app/settings/billing/upgrade"
                className={cn(
                  "inline-flex h-12 items-center rounded-full bg-foreground px-5 text-sm font-medium text-background",
                  "transition-opacity hover:opacity-90",
                )}
              >
                Try again
              </Link>
            )}
          </div>

          {checkoutId && (
            <p className="mt-10 border-t border-border/60 pt-4 font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
              Reference · {checkoutId}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
