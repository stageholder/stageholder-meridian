"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  usePricing,
  useSubscription,
  type PricingPlan,
} from "@stageholder/sdk/react";
import { CycleToggle } from "@/components/billing/cycle-toggle";
import { PlanTierCard } from "@/components/billing/plan-tier-card";
import { ComparisonSheet } from "@/components/billing/comparison-sheet";
import { cn } from "@/lib/utils";

/**
 * Meridian's plan-selection page. Built from `usePricing()` and
 * `useSubscription()` only — no high-level SDK component. The featured
 * plan offsets vertically out of the row to break the cookie-cutter
 * pricing-grid feel; everything else is hairline rules and editorial type.
 */
export default function UpgradePage() {
  const sub = useSubscription();
  const { plans, features, isLoading } = usePricing("meridian");
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");

  const ordered = useMemo(() => orderPlans(plans), [plans]);
  const yearlyDiscountLabel = useMemo(
    () => bestYearlyDiscountLabel(plans),
    [plans],
  );

  return (
    <div className="billing-paper relative min-h-screen bg-background">
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-10 md:py-16">
        {/* Back link */}
        <div className="mb-10">
          <Link
            href="/app/settings/billing"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to billing
          </Link>
        </div>

        {/* Hero */}
        <header className="billing-reveal billing-stagger-1 mb-12 grid gap-10 md:grid-cols-[1.6fr_1fr] md:items-end">
          <div className="space-y-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-foreground/55">
              Plans
            </p>
            <h1
              className={cn(
                "text-[clamp(2.5rem,7vw,5.5rem)] leading-[0.92] tracking-[-0.02em]",
              )}
              style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
            >
              Choose your plan
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
              Same Meridian, different limits. Upgrade or downgrade at any time
              — you can cancel from the billing page.
            </p>
          </div>
          <div className="flex flex-col items-start gap-5 md:items-end">
            <CycleToggle
              value={cycle}
              onChange={setCycle}
              yearlyDiscountLabel={yearlyDiscountLabel}
            />
            <p className="max-w-[260px] text-xs text-muted-foreground md:text-right">
              Prices shown in your local currency. Taxes included where
              applicable.
            </p>
          </div>
        </header>

        {/* Plan grid */}
        <div className="relative">
          {/* Background register marks behind the grid */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-1/2 -z-0 hidden -translate-y-1/2 md:block"
          >
            <div className="mx-auto h-px w-full bg-border/60" />
          </div>

          {isLoading || !ordered || !features ? (
            <PlanGridSkeleton />
          ) : (
            <ul
              className={cn(
                "relative grid gap-6 md:gap-8",
                ordered.length === 1 && "md:grid-cols-1",
                ordered.length === 2 && "md:grid-cols-2",
                ordered.length === 3 && "md:grid-cols-3",
                ordered.length >= 4 && "md:grid-cols-2 lg:grid-cols-4",
              )}
            >
              {ordered.map((plan, i) => {
                const isCurrent = sub?.plan === plan.slug;
                return (
                  <li
                    key={plan.id}
                    className={cn(
                      "billing-reveal",
                      i === 0 && "billing-stagger-2",
                      i === 1 && "billing-stagger-3",
                      i === 2 && "billing-stagger-4",
                      i === 3 && "billing-stagger-5",
                      // Featured plan rises out of the baseline grid
                      plan.isFeatured && "md:-translate-y-6",
                    )}
                  >
                    <PlanTierCard
                      plan={plan}
                      catalog={features}
                      cycle={cycle}
                      isCurrent={isCurrent}
                      className="h-full"
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Comparison sheet */}
        {!isLoading && ordered && features && features.length > 0 && (
          <div className="billing-reveal billing-stagger-6 mt-24">
            <ComparisonSheet plans={ordered} features={features} />
          </div>
        )}

        {/* Closing mark */}
        <footer className="mt-20 flex flex-wrap items-baseline justify-between gap-4 border-t border-border/60 pt-6">
          <p className="text-base font-medium">Questions about your plan?</p>
          <a
            href="mailto:hello@meridian.app"
            className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            hello@meridian.app
          </a>
        </footer>
      </div>
    </div>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Sort plans for display. Free first, then ascending price. The featured
 * plan keeps its natural ordering — its visual prominence is handled by
 * the `-translate-y-6` lift in the grid, not by reordering, so the
 * comparison table below stays intuitive (cheapest → most expensive).
 */
function orderPlans(plans: PricingPlan[] | null): PricingPlan[] | null {
  if (!plans) return null;
  return [...plans].sort((a, b) => {
    if (a.isFreeTier && !b.isFreeTier) return -1;
    if (!a.isFreeTier && b.isFreeTier) return 1;
    const ap = a.priceMonthly ?? Number.POSITIVE_INFINITY;
    const bp = b.priceMonthly ?? Number.POSITIVE_INFINITY;
    return ap - bp;
  });
}

/**
 * Find the deepest yearly discount across paid plans and render it as
 * "save 16%" — used as a callout on the cycle toggle. Returns undefined
 * when no plan has both a monthly and a yearly price set, since there's
 * no honest comparison to print.
 */
function bestYearlyDiscountLabel(
  plans: PricingPlan[] | null,
): string | undefined {
  if (!plans) return undefined;
  let best = 0;
  for (const p of plans) {
    if (!p.priceMonthly || !p.priceYearly) continue;
    const annualOnMonthly = p.priceMonthly * 12;
    const saving = (annualOnMonthly - p.priceYearly) / annualOnMonthly;
    if (saving > best) best = saving;
  }
  if (best <= 0) return undefined;
  return `Save ${Math.round(best * 100)}%`;
}

function PlanGridSkeleton() {
  return (
    <ul className="grid gap-6 md:grid-cols-3 md:gap-8">
      {Array.from({ length: 3 }).map((_, i) => (
        <li
          key={i}
          className="h-[520px] animate-pulse rounded-[28px] border border-border/60 bg-card/40"
        />
      ))}
    </ul>
  );
}
