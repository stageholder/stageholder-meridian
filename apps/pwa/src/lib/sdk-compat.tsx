/**
 * SDK SPA-mode compatibility shim for Meridian's billing surface.
 *
 * `@stageholder/sdk/spa` (alpha.45) exposes a tighter surface than `/react`
 * — billing hooks (`useStartCheckout`, `useBillingPortal`, `useCheckoutStatus`,
 * `formatPlanPrice`) aren't re-exported for SPA mode because they were
 * designed against a same-origin BFF. Atlas solved this by deep-linking to
 * the Hub's billing UI; meridian does the same here.
 *
 * Each export below mirrors the shape of the original `/react` hook so the
 * existing call sites in `components/billing/*` and `_app/settings/billing/*`
 * compile and behave correctly without a wholesale rewrite.
 *
 * Once the SDK ships SPA-native billing hooks, swap consumers back to
 * `@stageholder/sdk/spa` and delete this file.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAuthenticatedFetch,
  useOrg,
  useStageholder,
  useUser,
} from "@stageholder/sdk/spa";
import type { PricingPlan, ProductFeature } from "@stageholder/sdk/react";

/**
 * Hub has TWO origins in dev (one in prod):
 *   - API service (`/api/account/*`, `/api/billing/*`, `/api/users/me`)
 *     → cross-origin fetches use this URL.
 *     Dev: http://localhost:4828   Prod: id.stageholder.com
 *   - Web UI (account pages, billing portal, checkout deep-links)
 *     → `window.location.href` redirects use this URL.
 *     Dev: http://localhost:4829   Prod: same host as API in prod
 *
 * The two are separate dev services. Using the WEB url for API fetches
 * is what caused the CORS rejection (the web service doesn't expose the
 * `/api/*` surface AND doesn't grant CORS for cross-origin XHR).
 *
 * Resolution order for the API base:
 *   1. `VITE_HUB_API_URL` if explicitly set
 *   2. Derive from `VITE_IDENTITY_ISSUER_URL` by stripping the `/oidc`
 *      suffix — the OIDC issuer always lives on the API origin, so this
 *      fallback works without any extra env config.
 *
 * Pattern lifted from atlas's working SPA migration — see
 * `stageholder-atlas/apps/pwa/src/lib/sdk-compat.ts`.
 */
function resolveHubApiBase(): string {
  const explicit = import.meta.env.VITE_HUB_API_URL as string | undefined;
  if (typeof explicit === "string" && explicit.length > 0) {
    return explicit.replace(/\/+$/, "");
  }
  const issuer = import.meta.env.VITE_IDENTITY_ISSUER_URL as string | undefined;
  if (typeof issuer === "string" && issuer.length > 0) {
    return issuer.replace(/\/?oidc\/?$/, "").replace(/\/+$/, "");
  }
  return "";
}

/** Hub's REST API base — for authenticated cross-origin fetches. */
const HUB_API = resolveHubApiBase();

/** Hub's user-facing web UI base — for `window.location.href` redirects. */
const HUB_WEB = (
  (import.meta.env.VITE_HUB_WEB_URL as string | undefined) ?? ""
).replace(/\/+$/, "");

const hubFetch: typeof fetch = createAuthenticatedFetch();

async function hubJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await hubFetch(`${HUB_API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    throw new Error(`Hub ${res.status} ${res.statusText} on ${path}`);
  }
  const text = await res.text();
  return (text.length > 0 ? JSON.parse(text) : undefined) as T;
}

// ─── formatPlanPrice ─────────────────────────────────────────────────────

/**
 * Currency-aware formatter matching the SDK's internal `formatPlanPrice`.
 * Returns "Free" for unset/zero values; otherwise the localised currency
 * string. Hub stores Polar/Stripe minor units — divide by 100 for display.
 */
export function formatPlanPrice(
  amountMinor: number | undefined | null,
  currency = "USD",
): string {
  if (!amountMinor) return "Free";
  const amount = amountMinor / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

// ─── useStartCheckout (POST to Hub API → Polar) ─────────────────────────

export interface StartCheckoutInput {
  /** Optional override — defaults to the active org from `useOrg()`. */
  orgId?: string;
  /** Optional override — defaults to "meridian". */
  product?: string;
  planSlug: string;
  billingCycle: "monthly" | "yearly";
  /** Where Polar redirects after success/cancel. Defaults to the
   *  billing-success route in this app. */
  returnUrl?: string;
}

interface CheckoutResponse {
  /** Polar hosted-checkout URL. Caller navigates here directly. */
  checkoutUrl?: string;
  /** Some Hub revisions return `url` instead of `checkoutUrl`. */
  url?: string;
}

export interface StartCheckoutResult {
  /** Polar hosted-checkout URL — navigate to it via `window.location.href`. */
  url: string;
}

/**
 * Begin a Polar checkout for the given plan. POSTs to Hub's
 * `/api/billing/checkout`; Hub creates the Polar checkout session
 * server-side and returns the hosted-checkout URL. The caller is
 * expected to navigate to that URL (`window.location.href = result.url`)
 * — Polar's hosted page handles payment, then redirects back to
 * `returnUrl`.
 *
 * Pattern lifted from almanac's working SPA setup. The previous
 * "deep-link to `${HUB_WEB}/billing/checkout`" was wrong — the Hub web
 * UI doesn't expose a checkout deep-link with these query params, so the
 * user would land on a Hub page instead of Polar.
 */
export function useStartCheckout() {
  const { org } = useOrg();
  return useMutation<StartCheckoutResult, Error, StartCheckoutInput>({
    mutationFn: async (input) => {
      const orgId = input.orgId ?? org?.id;
      if (!orgId) {
        throw new Error("No active org to start checkout against");
      }
      const body = {
        orgId,
        product: input.product ?? "meridian",
        planSlug: input.planSlug,
        billingCycle: input.billingCycle,
        returnUrl:
          input.returnUrl ??
          `${window.location.origin}/settings/billing/success`,
      };
      const res = await hubJson<CheckoutResponse>("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const url = res.checkoutUrl ?? res.url;
      if (!url) throw new Error("Hub returned no checkout URL");
      return { url };
    },
  });
}

// ─── useBillingPortal (POST to Hub API → Polar portal) ──────────────────

export interface OpenBillingPortalInput {
  /** Optional override — defaults to the active org from `useOrg()`. */
  orgId?: string;
  /** Where Polar redirects when the user hits "back" in the portal. */
  returnUrl?: string;
}

interface PortalResponse {
  portalUrl?: string;
  url?: string;
}

/**
 * Open Polar's customer-billing portal. POSTs to Hub's
 * `/api/billing/portal/:orgId`; Hub creates a Polar portal session and
 * returns the URL. The mutation navigates to that URL directly via
 * `window.location.href`.
 *
 * Mutation shape (`mutate`/`mutateAsync`/`isPending`) + the legacy
 * `open()` alias kept for back-compat with call sites written against
 * the original SDK `/react` hook.
 */
export function useBillingPortal() {
  const { org } = useOrg();

  const mutation = useMutation<void, Error, OpenBillingPortalInput | undefined>(
    {
      mutationFn: async (input) => {
        const orgId = input?.orgId ?? org?.id;
        if (!orgId) {
          throw new Error("No active org to open billing portal for");
        }
        const body = {
          returnUrl:
            input?.returnUrl ?? `${window.location.origin}/settings/billing`,
        };
        const res = await hubJson<PortalResponse>(
          `/api/billing/portal/${orgId}`,
          {
            method: "POST",
            body: JSON.stringify(body),
          },
        );
        const url = res.portalUrl ?? res.url;
        if (!url) throw new Error("Hub returned no portal URL");
        window.location.href = url;
      },
    },
  );

  // Legacy `open()` alias — same signature as the SDK's original hook.
  const open = (input?: OpenBillingPortalInput): Promise<void> =>
    mutation.mutateAsync(input);

  return {
    open,
    isPending: mutation.isPending,
    error: mutation.error,
    mutate: mutation.mutate,
    mutateAsync: mutation.mutateAsync,
  };
}

// ─── useChangePlan (POST to Hub API for existing subscribers) ───────────

export interface ChangePlanInput {
  orgId?: string;
  product?: string;
  planSlug: string;
  billingCycle: "monthly" | "yearly";
}

interface ChangePlanResponse {
  /** Some endpoints redirect via URL; others complete server-side and
   *  return nothing. Both shapes handled. */
  url?: string;
}

/**
 * Swap an existing Polar subscription onto a different plan. Used by
 * `plan-tier-card.tsx` when the org already has a subscription —
 * checkout would create a duplicate. Hub calls
 * `polar.subscriptions.update({product_id})` server-side. Polar fires
 * `subscription.updated` webhook → Hub refreshes the local row.
 *
 * Returns `{ url }` when Polar wants the user to confirm via its hosted
 * UI (rare — usually used for proration confirmations), `null` when the
 * change settled server-side without a redirect.
 */
export function useChangePlan() {
  const { org } = useOrg();
  return useMutation<{ url: string | null }, Error, ChangePlanInput>({
    mutationFn: async (input) => {
      const orgId = input.orgId ?? org?.id;
      if (!orgId) throw new Error("No active org to change plan against");
      const body = {
        orgId,
        product: input.product ?? "meridian",
        planSlug: input.planSlug,
        billingCycle: input.billingCycle,
      };
      const res = await hubJson<ChangePlanResponse>(
        "/api/billing/change-plan",
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );
      return { url: res.url ?? null };
    },
  });
}

// ─── useCheckoutStatus (poll Hub) ────────────────────────────────────────

/**
 * Phase vocabulary the success page consumes — matches the SDK's original
 * `/react` hook contract so call-site state machines work unchanged:
 *
 * - `idle`       — no checkoutId passed; nothing to poll
 * - `polling`    — Hub returned pending/processing; we're still waiting
 * - `succeeded`  — Polar confirmed; safe to refresh session
 * - `failed`     — Polar returned a structured failure
 * - `error`      — network / parse failure talking to Hub
 * - `timeout`    — exceeded `MAX_POLL_DURATION_MS` without resolution
 */
export type CheckoutPhase =
  | "idle"
  | "polling"
  | "succeeded"
  | "failed"
  | "error"
  | "timeout";

export interface CheckoutStatusResponse {
  /** Polar's raw status string, surfaced for UI subhead copy. */
  status?: "pending" | "processing" | "succeeded" | "failed" | "expired";
  errorCode?: string;
  errorMessage?: string;
}

const MAX_POLL_DURATION_MS = 15_000;

/**
 * Polls Hub's Polar passthrough at `/api/billing/checkout/:id` every
 * 1.5 s while pending/processing, until Polar reports a terminal state
 * OR `MAX_POLL_DURATION_MS` elapses (whichever comes first). The `phase`
 * field surfaces the original /react hook's state machine so the
 * billing-success page can drive its UI off it without changes.
 *
 * Hub mounts the checkout-status endpoint at `/api/billing/checkout/:id`
 * (NestJS `billing.controller.ts` — `@Get("checkout/:id")`). My earlier
 * guess `/checkout/:id/status` was wrong.
 */
export function useCheckoutStatus(opts: { checkoutId: string | null }) {
  const [startedAt] = useState(() => Date.now());

  const q = useQuery<CheckoutStatusResponse, Error>({
    queryKey: ["sdk-compat", "checkout-status", opts.checkoutId],
    enabled: !!opts.checkoutId,
    queryFn: () =>
      hubJson<CheckoutStatusResponse>(
        `/api/billing/checkout/${opts.checkoutId}`,
      ),
    refetchInterval: (qq) => {
      const s = qq.state.data?.status;
      const stillRunning =
        s === "pending" || s === "processing" || s === undefined;
      const timedOut = Date.now() - startedAt > MAX_POLL_DURATION_MS;
      return stillRunning && !timedOut ? 1500 : false;
    },
  });

  const elapsed = Date.now() - startedAt;
  const phase: CheckoutPhase = (() => {
    if (!opts.checkoutId) return "idle";
    if (q.isError) return "error";
    const s = q.data?.status;
    if (s === "succeeded") return "succeeded";
    if (s === "failed" || s === "expired") return "failed";
    if (elapsed > MAX_POLL_DURATION_MS) return "timeout";
    return "polling";
  })();

  return {
    data: q.data,
    phase,
    isLoading: q.isLoading,
    error: q.error ?? null,
  };
}

// ─── useRefreshSession (wraps SDK's refresh) ─────────────────────────────

/**
 * Calls the SPA provider's `refreshSession` — same imperative shape the
 * original /react `useRefreshSession` mutation had. Throws on failure so
 * callers can match on `RefreshSessionError` (re-exported from
 * `@stageholder/sdk/spa`) for status-aware retry.
 *
 * IMPORTANT — stable reference: the returned function has empty `useCallback`
 * deps so its identity never changes across re-renders. The SDK's
 * `useStageholder()` produces a fresh context value on every state churn
 * (refresh, switchOrg, etc.); if we naively closed over `ctx.refreshSession`
 * with that in deps, every consumer's `useEffect` with this function in its
 * deps would re-run on every SDK update and cancel itself mid-flight —
 * exactly the failure that left the billing-success page stuck at
 * "Refreshing your access…" forever. The ref pattern reads the latest
 * `refreshSession` at call time without invalidating consumers' effects.
 */
export function useRefreshSession() {
  const ctx = useStageholder() as { refreshSession?: () => Promise<void> };
  const ref = useRef(ctx.refreshSession);
  ref.current = ctx.refreshSession;
  return useCallback(async (): Promise<void> => {
    const fn = ref.current;
    if (typeof fn !== "function") {
      throw new Error("refreshSession unavailable on SPA provider");
    }
    await fn();
  }, []);
}

// ─── useProfile / useUpdateProfile (direct to Hub) ───────────────────────

export interface HubProfile {
  sub: string;
  email?: string;
  /** Hub's `display_name` mapped to camelCase. SDK call sites read this. */
  displayName?: string;
  /** Legacy alias surfaced by older Hub responses — same value as displayName. */
  name?: string;
  picture?: string;
  timezone?: string;
  locale?: string;
}

/**
 * Hub mounts the profile endpoints under `/api/account/profile`
 * (NestJS `apps/api/src/account/account.controller.ts`). GET returns the
 * full profile; PUT (not PATCH) replaces editable fields.
 */
export function useProfile() {
  const { user } = useUser();
  return useQuery<HubProfile, Error>({
    queryKey: ["sdk-compat", "profile", user?.sub],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: () => hubJson<HubProfile>("/api/account/profile"),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  const { user } = useUser();
  return useMutation({
    mutationFn: (patch: Partial<HubProfile>) =>
      hubJson<HubProfile>("/api/account/profile", {
        method: "PUT",
        body: JSON.stringify(patch),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["sdk-compat", "profile", user?.sub] }),
  });
}

// ─── useInvoices (direct to Hub) ─────────────────────────────────────────

export interface HubInvoice {
  id: string;
  number?: string;
  status: string;
  amountTotal: number;
  totalFormatted?: string;
  currency: string;
  issuedAt: string;
  createdAt: string;
  billingReason?: string;
  pdfUrl?: string;
}

/**
 * Hub mounts invoices under `/api/billing/invoices/:orgId` — different
 * from `/api/billing/:orgId/invoices` which I initially guessed wrong.
 * See `stageholder-identity/apps/api/src/billing/billing.controller.ts`
 * for the canonical route table.
 */
export function useInvoices() {
  const { org } = useOrg();
  return useQuery<HubInvoice[], Error>({
    queryKey: ["sdk-compat", "invoices", org?.id],
    enabled: !!org?.id,
    staleTime: 30_000,
    queryFn: () => hubJson<HubInvoice[]>(`/api/billing/invoices/${org!.id}`),
  });
}

// ─── usePricing (direct to Hub) ──────────────────────────────────────────

export interface PricingCatalogResponse {
  plans: PricingPlan[];
  features: ProductFeature[];
}

/**
 * Accepts either a positional product slug (`usePricing("meridian")`) or
 * an options bag (`usePricing({ product: "meridian" })`) to match the
 * original SDK's overloaded signature. `plans`/`features` are typed
 * against the SDK's `PricingPlan` / `ProductFeature` so call sites that
 * pass them into typed components compile.
 *
 * Hub mounts pricing at `/api/billing/pricing/:product` (path param, not
 * query string). See `stageholder-identity/apps/api/src/billing/pricing.controller.ts`.
 */
export function usePricing(arg?: string | { product?: string }) {
  const product = typeof arg === "string" ? arg : (arg?.product ?? "meridian");
  const q = useQuery<PricingCatalogResponse, Error>({
    queryKey: ["sdk-compat", "pricing", product],
    staleTime: 5 * 60_000,
    queryFn: () =>
      hubJson<PricingCatalogResponse>(
        `/api/billing/pricing/${encodeURIComponent(product)}`,
      ),
  });
  return {
    data: q.data,
    plans: q.data?.plans ?? null,
    features: q.data?.features ?? null,
    isLoading: q.isLoading,
    isError: q.isError,
    error: q.error ?? null,
  };
}

// ─── usePaywall (local controller + ServiceWrapper event listener) ───────

export interface PaywallReason {
  feature: string;
  featureLabel?: string;
  currentLimit?: number;
  product?: string;
  suggestedPlan?: string;
  suggestedPlanName?: string;
  /** Optional copy override for the modal headline (e.g. error-code-specific). */
  customMessage?: string;
  /** What the user was trying to do — used for analytics + copy. */
  attemptedAction?: string;
}

export interface UsePaywallResult {
  isOpen: boolean;
  reason: PaywallReason | null;
  open: (reason: PaywallReason) => void;
  close: () => void;
}

const PaywallContext = createContext<UsePaywallResult | null>(null);

/**
 * SPA-compatible paywall controller. Mount `<PaywallProvider>` near the
 * root (inside `<StageholderSpaProvider>`); `usePaywall()` returns the
 * shared open/close interface. Replaces the SDK's `/react` `usePaywall`
 * which only reads from the BFF-flavored StageholderContext (dual-package
 * hazard — would crash under SPA mode).
 */
export function PaywallProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    isOpen: boolean;
    reason: PaywallReason | null;
  }>({ isOpen: false, reason: null });

  // ServiceWrapper dispatches this event on 402 responses; surface it as
  // an open() call so the modal renders without needing a hook-side
  // call site for every API mutation.
  useEffect(() => {
    function onPaywallEvent(e: Event) {
      const detail = (e as CustomEvent<PaywallReason>).detail;
      if (!detail) return;
      setState({ isOpen: true, reason: detail });
    }
    window.addEventListener("meridian:paywall", onPaywallEvent);
    return () => window.removeEventListener("meridian:paywall", onPaywallEvent);
  }, []);

  const value: UsePaywallResult = {
    isOpen: state.isOpen,
    reason: state.reason,
    open: (reason) => setState({ isOpen: true, reason }),
    close: () => setState((s) => ({ isOpen: false, reason: s.reason })),
  };
  return (
    <PaywallContext.Provider value={value}>{children}</PaywallContext.Provider>
  );
}

export function usePaywall(): UsePaywallResult {
  const ctx = useContext(PaywallContext);
  if (!ctx) {
    throw new Error(
      "usePaywall() must be called inside <PaywallProvider> from @/lib/sdk-compat.",
    );
  }
  return ctx;
}

// ─── useCanManageBilling (personal-only) ─────────────────────────────────

/**
 * Meridian is personal-only — there are no team orgs in this product,
 * and the active org is always the user's auto-provisioned personal
 * workspace. By definition the user is the owner; the answer is always
 * `true` once we have a user and an active org.
 *
 * If you ever add team-org support later, restore the kind/role branching:
 *   if (o.kind === "personal") return { canManage: true };
 *   return { canManage: o.role === "owner" || o.role === "admin" };
 */
export function useCanManageBilling(): { canManage: boolean } {
  const { user } = useUser();
  const { org } = useOrg();
  return { canManage: !!user && !!org };
}
