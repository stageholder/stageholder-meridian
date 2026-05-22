import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import {
  usePricing,
  useSubscription,
  type PricingPlan,
} from "@stageholder/sdk/spa";
import { CycleToggle } from "@/components/billing/cycle-toggle";
import { PlanTierCard } from "@/components/billing/plan-tier-card";
import { ComparisonSheet } from "@/components/billing/comparison-sheet";
import { H1, Paragraph, Text, View, XStack, YStack } from "@stageholder/ui";

/**
 * Meridian's plan-selection page. Built from `usePricing()` and
 * `useSubscription()` only — no high-level SDK component. The featured
 * plan offsets vertically out of the row to break the cookie-cutter
 * pricing-grid feel; everything else is hairline rules and editorial type.
 */
export const Route = createFileRoute("/_app/settings/billing/upgrade")({
  component: UpgradePage,
});

function UpgradePage() {
  const sub = useSubscription();
  const { data: pricing, isLoading } = usePricing("meridian");
  const plans = pricing?.plans;
  const features = pricing?.features;
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");

  const ordered = useMemo(() => orderPlans(plans), [plans]);
  const yearlyDiscountLabel = useMemo(
    () => bestYearlyDiscountLabel(plans),
    [plans],
  );

  // Responsive plan-grid template — exact column counts matter, so map the
  // plan count to a CSS grid template (md+) instead of auto-fit.
  const planCount = ordered?.length ?? 0;
  const mdCols =
    planCount >= 4
      ? "repeat(2, minmax(0, 1fr))"
      : `repeat(${Math.max(planCount, 1)}, minmax(0, 1fr))`;
  const lgCols = planCount >= 4 ? "repeat(4, minmax(0, 1fr))" : undefined;

  return (
    // allowlist: billing-paper texture (globals.css, no token equivalent)
    <View
      position="relative"
      minH={"100vh" as never}
      bg="$background"
      className="billing-paper"
    >
      <YStack
        position="relative"
        z={10}
        mx="auto"
        maxW={1152}
        px="$4"
        py="$7"
        $md={{ py: "$10" }}
      >
        {/* Back link */}
        <View mb="$7">
          <Link to="/settings/billing" style={{ textDecoration: "none" }}>
            <XStack
              items="center"
              gap="$1.5"
              fontSize="$3"
              color="$mutedForeground"
              transition="quick"
              hoverStyle={{ color: "$color" }}
            >
              <ArrowLeft size={16} />
              Back to billing
            </XStack>
          </Link>
        </View>

        {/* Hero */}
        {/* allowlist: billing-reveal/stagger keyframes (globals.css) */}
        <View
          tag="header"
          className="billing-reveal billing-stagger-1"
          mb={48}
          display="grid"
          gap="$7"
          gridTemplateColumns={"1fr" as never}
          $md={{
            gridTemplateColumns: "1.6fr 1fr" as never,
            alignItems: "flex-end",
          }}
        >
          <YStack gap="$4.5">
            {/* allowlist: editorial mono kicker — letter-spacing + foreground tint */}
            <Paragraph className="font-mono text-[11px] uppercase tracking-[0.32em] text-foreground/55">
              Plans
            </Paragraph>
            {/* allowlist: display-font + clamp() responsive size (CSS var, no kit token) */}
            <H1
              className="text-[clamp(2.5rem,7vw,5.5rem)] leading-[0.92] tracking-[-0.02em]"
              style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
            >
              Choose your plan
            </H1>
            <Paragraph maxW={576} fontSize="$5" color="$mutedForeground">
              Same Meridian, different limits. Upgrade or downgrade at any time
              — you can cancel from the billing page.
            </Paragraph>
          </YStack>
          <YStack items="flex-start" gap="$4.5" $md={{ items: "flex-end" }}>
            <CycleToggle
              value={cycle}
              onChange={setCycle}
              yearlyDiscountLabel={yearlyDiscountLabel}
            />
            <Paragraph
              maxW={260}
              fontSize="$1"
              color="$mutedForeground"
              $md={{ text: "right" }}
            >
              Prices shown in your local currency. Taxes included where
              applicable.
            </Paragraph>
          </YStack>
        </View>

        {/* Plan grid */}
        <View position="relative">
          {/* Background register marks behind the grid */}
          <View
            aria-hidden
            position="absolute"
            l={0}
            r={0}
            t="50%"
            z={0}
            pointerEvents="none"
            display="none"
            className="-translate-y-1/2"
            $md={{ display: "block" }}
          >
            {/* allowlist: foreground-tinted hairline (no token equivalent) */}
            <View mx="auto" height={1} width="100%" className="bg-border/60" />
          </View>

          {isLoading || !ordered || !features ? (
            <PlanGridSkeleton />
          ) : (
            <View
              tag="ul"
              position="relative"
              display="grid"
              gap="$5"
              gridTemplateColumns={"1fr" as never}
              $md={{ gap: "$6", gridTemplateColumns: mdCols as never }}
              $lg={
                lgCols ? { gridTemplateColumns: lgCols as never } : undefined
              }
            >
              {ordered.map((plan, i) => {
                const isCurrent = sub?.plan === plan.slug;
                return (
                  <View
                    key={plan.id}
                    tag="li"
                    // allowlist: billing-reveal/stagger keyframes; md:-translate-y-6
                    // featured-plan lift (CSS transform, no token equivalent)
                    className={[
                      "billing-reveal",
                      i === 0 && "billing-stagger-2",
                      i === 1 && "billing-stagger-3",
                      i === 2 && "billing-stagger-4",
                      i === 3 && "billing-stagger-5",
                      plan.isFeatured && "md:-translate-y-6",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <PlanTierCard
                      plan={plan}
                      catalog={features}
                      cycle={cycle}
                      isCurrent={isCurrent}
                      className="h-full"
                    />
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Comparison sheet */}
        {!isLoading && ordered && features && features.length > 0 && (
          // allowlist: billing-reveal/stagger keyframes (globals.css)
          <View className="billing-reveal billing-stagger-6" mt={96}>
            <ComparisonSheet plans={ordered} features={features} />
          </View>
        )}

        {/* Closing mark */}
        {/* allowlist: border-border/60 hairline tint (no token equivalent) */}
        <XStack
          tag="footer"
          mt={80}
          flexWrap="wrap"
          items="baseline"
          justify="space-between"
          gap="$4"
          borderTopWidth={1}
          pt="$5"
          className="border-border/60"
        >
          <Text fontSize="$5" fontWeight="500">
            Questions about your plan?
          </Text>
          {/* allowlist: hover underline on the mailto link (no token equivalent) */}
          <Text
            tag="a"
            href="mailto:hello@meridian.app"
            fontSize="$3"
            fontWeight="500"
            color="$color"
            className="underline-offset-4 hover:underline"
          >
            hello@meridian.app
          </Text>
        </XStack>
      </YStack>
    </View>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Sort plans for display. Free first, then ascending price. The featured
 * plan keeps its natural ordering — its visual prominence is handled by
 * the `-translate-y-6` lift in the grid, not by reordering, so the
 * comparison table below stays intuitive (cheapest → most expensive).
 */
function orderPlans(
  plans: PricingPlan[] | undefined,
): PricingPlan[] | undefined {
  if (!plans) return undefined;
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
  plans: PricingPlan[] | undefined,
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
    <View
      tag="ul"
      display="grid"
      gap="$5"
      gridTemplateColumns={"1fr" as never}
      $md={{
        gap: "$6",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))" as never,
      }}
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <View
          key={i}
          tag="li"
          height={520}
          rounded={28}
          borderWidth={1}
          // allowlist: animate-pulse keyframe + card/border translucency (no token equivalent)
          className="animate-pulse border-border/60 bg-card/40"
        />
      ))}
    </View>
  );
}
