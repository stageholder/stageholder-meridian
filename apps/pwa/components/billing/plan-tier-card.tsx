"use client";
import { useState } from "react";
import Link from "next/link";
import type { PricingPlan, ProductFeature } from "@stageholder/sdk/react";
import {
  BillingError,
  useCanManageBilling,
  useOrg,
  useStageholder,
  useStartCheckout,
} from "@stageholder/sdk/react";
import { OrbitIllustration } from "./orbit-illustration";
import { cn } from "@/lib/utils";
import { ArrowUpRight, AlertCircle, Building2, Check } from "lucide-react";

/**
 * Single pricing-tier card. Editorial layout: vertical "Plan / 01" gutter
 * mark, large display-serif plan name, mono price, abstract orbital
 * illustration tied to the tier. The featured plan rises out of the
 * baseline grid via {@link className} prop on the parent.
 *
 * Renders without using the SDK's `<PlanCard>` — proves the SDK's headless
 * surface (`usePricing`, `useStartCheckout`, `useCanManageBilling`) is
 * enough to ship a fully custom pricing experience.
 */
export function PlanTierCard({
  plan,
  catalog,
  cycle,
  isCurrent,
  className,
}: {
  plan: PricingPlan;
  catalog: ProductFeature[];
  cycle: "monthly" | "yearly";
  isCurrent: boolean;
  className?: string;
}) {
  const { mutateAsync, isPending } = useStartCheckout();
  const { canManage } = useCanManageBilling();
  const { org, organizations } = useOrg();
  const { state } = useStageholder();
  const [errorState, setErrorState] = useState<{
    code: string | null;
    message: string;
  } | null>(null);

  // mutate() swallows errors and only console.errors them — we need the
  // structured error to drive inline UI, so we use mutateAsync and handle
  // the redirect ourselves. Falls back to a generic message when the error
  // isn't a typed BillingError (network failures, 5xx HTML responses).
  async function startCheckout() {
    setErrorState(null);
    try {
      const { url } = await mutateAsync({
        planSlug: plan.slug,
        billingCycle: cycle,
        returnUrl: `${window.location.origin}/app/settings/billing/success`,
      });
      window.location.href = url;
    } catch (err) {
      if (err instanceof BillingError) {
        setErrorState({ code: err.code, message: err.message });
      } else {
        setErrorState({
          code: null,
          message:
            err instanceof Error
              ? err.message
              : "Could not start checkout. Please try again.",
        });
      }
    }
  }
  // Show the active-org label only when the user has more than one org —
  // otherwise it's noise. Single-org Meridian users (the majority) see no
  // extra chrome.
  const showActiveOrgLabel =
    state.status === "authenticated" && organizations.length > 1 && !!org;

  const tier: "rest" | "practice" | "conduct" = plan.isFreeTier
    ? "rest"
    : plan.isFeatured
      ? "conduct"
      : "practice";

  const price = cycle === "monthly" ? plan.priceMonthly : plan.priceYearly;
  const bullets = derivePlanBullets(plan, catalog, 4);
  const hasTrial = !!plan.trialDays && plan.trialDays > 0 && !plan.isFreeTier;
  const ctaLabel = isPending
    ? "Redirecting to checkout…"
    : hasTrial
      ? `Start ${plan.trialDays}-day free trial`
      : `Get ${plan.displayName}`;

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden",
        "rounded-[28px] border border-border/70 bg-card/85 backdrop-blur-sm",
        "px-7 pb-7 pt-8 transition-all duration-500",
        "hover:border-foreground/30 hover:shadow-[0_30px_70px_-40px_color-mix(in_oklch,var(--foreground)_30%,transparent)]",
        plan.isFeatured &&
          "border-foreground/30 shadow-[0_24px_60px_-30px_color-mix(in_oklch,var(--foreground)_25%,transparent)]",
        className,
      )}
    >
      {/* Featured badge — clear "this is the recommended pick" */}
      {plan.isFeatured && (
        <div
          className={cn(
            "absolute right-7 top-7 inline-flex items-center gap-1.5 rounded-full",
            "border border-foreground/40 bg-background/90 px-2.5 py-1 text-xs font-medium text-foreground/80",
          )}
        >
          <span className="size-1.5 rounded-full bg-foreground/80" />
          Most popular
        </div>
      )}

      {/* Illustration — fills the card top, masked to the rounded corners */}
      <div
        className={cn(
          "relative -mx-7 -mt-8 mb-6 h-44 overflow-hidden border-b border-border/60",
          "bg-[radial-gradient(ellipse_at_top,_color-mix(in_oklch,var(--foreground)_4%,transparent),_transparent_70%)]",
        )}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <OrbitIllustration tier={tier} className="h-[180px] w-[180px]" />
        </div>
      </div>

      {/* Plan name + description */}
      <header className="space-y-2">
        <h3
          className="text-[2rem] leading-[1.05] tracking-tight"
          style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
        >
          {plan.displayName}
        </h3>
        {plan.description && (
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            {plan.description}
          </p>
        )}
      </header>

      {/* Price block — tabular mono. Cents → display via formatPrice. */}
      <div className="mt-7 flex items-baseline gap-2">
        <span
          className={cn(
            "font-mono text-5xl font-medium leading-none tracking-tight tabular-nums",
            "text-foreground",
          )}
        >
          {formatPriceShort(price, plan.currency, plan.isFreeTier)}
        </span>
        {!plan.isFreeTier && price !== null && (
          <span className="text-sm text-muted-foreground">
            per {cycle === "monthly" ? "month" : "year"}
          </span>
        )}
      </div>
      {plan.trialDays && plan.trialDays > 0 && !plan.isFreeTier && (
        <p className="mt-2 text-xs text-foreground/60">
          {plan.trialDays}-day free trial first. No card today.
        </p>
      )}

      {/* Hairline */}
      <div aria-hidden className="my-7 h-px w-full bg-border/80" />

      {/* Bullets */}
      <ul className="flex flex-1 flex-col gap-3 text-[13px]">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-3 leading-snug">
            <span
              aria-hidden
              className={cn(
                "mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full",
                plan.isFeatured
                  ? "bg-foreground text-background"
                  : "bg-foreground/8 text-foreground/75",
              )}
            >
              <Check className="size-2.5" strokeWidth={3.5} />
            </span>
            <span className="text-foreground/85">{b}</span>
          </li>
        ))}
      </ul>

      {/* Active-org label — only when the user has multiple orgs, so they
          know which workspace gets billed. Single-org users see nothing. */}
      {showActiveOrgLabel && !isCurrent && !plan.isFreeTier && (
        <p className="mt-6 inline-flex items-center gap-1.5 self-start rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground">
          <Building2 className="size-3" strokeWidth={2} />
          Billing {org!.name}
        </p>
      )}

      {/* CTA */}
      <div className="mt-8">
        {isCurrent ? (
          <CurrentBadge />
        ) : plan.isFreeTier ? (
          <DisabledChip>Free plan</DisabledChip>
        ) : price === null ? (
          <ContactSalesLink />
        ) : !canManage ? (
          <DisabledChip>Ask your admin to upgrade</DisabledChip>
        ) : (
          <button
            type="button"
            disabled={isPending}
            onClick={() => void startCheckout()}
            className={cn(
              "group/btn relative inline-flex h-12 w-full items-center justify-between overflow-hidden rounded-full px-5",
              "text-sm font-medium",
              "transition-all duration-300",
              plan.isFeatured
                ? "bg-foreground text-background hover:opacity-90"
                : "bg-background border border-foreground/80 text-foreground hover:bg-foreground hover:text-background",
              "disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            <span className="z-10">{ctaLabel}</span>
            <span className="z-10 inline-flex size-7 items-center justify-center rounded-full border border-current/30 transition-transform duration-300 group-hover/btn:translate-x-1">
              <ArrowUpRight className="size-3.5" strokeWidth={2} />
            </span>
          </button>
        )}

        {/* Inline error surface — driven by structured BillingError codes
            from Hub. Reasons get specific, actionable copy; everything else
            falls back to the raw message so the failure isn't silent. */}
        {errorState && <CheckoutErrorBanner error={errorState} />}
      </div>
    </article>
  );
}

/**
 * Render a structured `BillingError` (or generic checkout failure) inline
 * under the upgrade button. Each `code` gets a tailored message + a follow-up
 * action when the user can fix the problem themselves.
 */
function CheckoutErrorBanner({
  error,
}: {
  error: { code: string | null; message: string };
}) {
  // Per-code overrides for messages whose Hub-side wording is too generic
  // for end-user UI, plus a follow-up `action` for cases the user can fix.
  const copy = explainBillingError(error.code);

  return (
    <div
      role="alert"
      className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200"
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
        <div className="space-y-2">
          <p className="leading-relaxed">{copy?.message ?? error.message}</p>
          {copy?.action}
        </div>
      </div>
    </div>
  );
}

interface ErrorCopy {
  message: string;
  action?: React.ReactNode;
}

function explainBillingError(code: string | null): ErrorCopy | null {
  switch (code) {
    case "BILLING_EMAIL_REJECTED":
      return {
        message:
          "Your billing email's domain doesn't accept mail, so the payment provider can't send you a receipt. Update it before continuing.",
        action: (
          <Link
            href="/app/settings/billing"
            className="inline-flex h-7 items-center rounded-full border border-rose-300 bg-white px-2.5 text-[11px] font-medium text-rose-900 hover:bg-rose-50 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-100 dark:hover:bg-rose-900/40"
          >
            Update billing email
          </Link>
        ),
      };
    case "PERSONAL_ORG_INELIGIBLE_PLAN":
      return {
        message:
          "This plan is only available on team workspaces. Switch to a team org or pick a different plan.",
      };
    case "POLAR_PRODUCT_TEAM_TYPE":
      return {
        message:
          "This plan is misconfigured on the billing provider. We've logged the issue — please contact support so we can fix it for you.",
      };
    case null:
      return null;
    default:
      // Unknown code — fall through to the raw Hub message rather than
      // hiding it. New error codes ship without an SDK release this way.
      return null;
  }
}

function CurrentBadge() {
  return (
    <div className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-dashed border-foreground/30 bg-foreground/4 text-sm font-medium text-foreground/70">
      <span className="size-1.5 rounded-full bg-foreground/70" />
      Your current plan
    </div>
  );
}

function DisabledChip({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex h-12 w-full items-center justify-center rounded-full border border-border bg-muted/40 text-sm font-medium text-muted-foreground">
      {children}
    </div>
  );
}

function ContactSalesLink() {
  return (
    <a
      href="mailto:hello@meridian.app"
      className="inline-flex h-12 w-full items-center justify-center rounded-full border border-foreground/80 bg-background text-sm font-medium text-foreground transition-colors hover:bg-foreground hover:text-background"
    >
      Contact sales
    </a>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatPriceShort(
  price: number | null,
  currency: "USD" | "IDR",
  isFreeTier: boolean,
): string {
  if (isFreeTier) return "Free";
  if (price === null) return "Custom";
  if (currency === "IDR") return `Rp ${price.toLocaleString("id-ID")}`;
  const major = price / 100;
  return `$${major.toLocaleString("en-US", {
    minimumFractionDigits: price % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Derive a short bullet list per plan. Mirrors the SDK's planBullets()
 * algorithm (highlightedFeatures > catalog × per-plan values > nothing) so
 * the custom card renders the same copy the SDK's PlanCard would.
 */
function derivePlanBullets(
  plan: PricingPlan,
  catalog: ProductFeature[],
  max: number,
): string[] {
  if (plan.highlightedFeatures && plan.highlightedFeatures.length > 0) {
    return plan.highlightedFeatures.slice(0, max);
  }
  const bag = plan.features ?? {};
  const out: string[] = [];
  const sorted = [...catalog].sort(
    (a, b) =>
      a.sortOrder - b.sortOrder || a.displayName.localeCompare(b.displayName),
  );
  for (const f of sorted) {
    if (out.length >= max) break;
    if (!(f.slug in bag)) continue;
    const v = bag[f.slug];
    if (f.valueType === "boolean") {
      if (v === true) out.push(f.displayName);
    } else if (f.valueType === "number") {
      if (v === null) out.push(`Unlimited ${f.displayName.toLowerCase()}`);
      else if (typeof v === "number")
        out.push(
          `${v.toLocaleString()}${f.unit ? ` ${f.unit}` : ""} ${f.displayName.toLowerCase()}`,
        );
    } else if (f.valueType === "text") {
      if (typeof v === "string" && v.length > 0)
        out.push(`${v} ${f.displayName.toLowerCase()}`);
    }
  }
  return out;
}
