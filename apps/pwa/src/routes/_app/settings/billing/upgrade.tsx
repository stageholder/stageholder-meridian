import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Anchor } from "tamagui";
import {
  usePricing,
  useSubscription,
  type PricingPlan,
} from "@stageholder/sdk/spa";
import { CycleToggle } from "@/components/billing/cycle-toggle";
import { PlanTierCard } from "@/components/billing/plan-tier-card";
import { ComparisonSheet } from "@/components/billing/comparison-sheet";
import {
  Banner,
  H1,
  Paragraph,
  Skeleton,
  Text,
  View,
  XStack,
  YStack,
  useMedia,
} from "@stageholder/ui";

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
  const media = useMedia();

  const ordered = useMemo(() => orderPlans(plans), [plans]);
  const yearlyDiscountLabel = useMemo(
    () => bestYearlyDiscountLabel(plans),
    [plans],
  );

  // Store-billed (App Store / Play via IAP) subscriptions can't be changed
  // from the web — a web checkout would start a SECOND subscription on a
  // different biller for the same product (contract §4). Point the user to
  // their phone instead. Default provider to "polar" when absent.
  const storeBilled =
    !!sub &&
    (sub.provider === "app_store" || sub.provider === "play") &&
    (sub.status === "active" || sub.status === "trialing");

  return (
    // allowlist: billing-paper texture (globals.css keyframe/bg, no token equivalent)
    <View
      position="relative"
      minH={"100vh" as never}
      bg="$background"
      overflow="hidden"
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
              transition="quick"
              // Text color cascades to the label + lucide icon (currentColor).
              // `color`/`fontSize` aren't in the View frame's prop type —
              // runtime CSS only — so they ride casts.
              {...({ fontSize: "$3", color: "$mutedForeground" } as object)}
              hoverStyle={{ color: "$color" } as never}
            >
              <ArrowLeft size={16} />
              <Text>Back to billing</Text>
            </XStack>
          </Link>
        </View>

        {/* Hero — column on mobile (title over the cycle toggle), row at md+.
            No `flex` on the columns at the mobile breakpoint: a flex child
            (flexBasis:0%) collapses to zero height inside an indefinite-height
            column on iOS WebKit, which is what made the title + toggle
            overlap. Width/natural-height on mobile; flex-share only at md+. */}
        <YStack
          render="header"
          enterStyle={{ opacity: 0, y: 14 }}
          transition="medium"
          mb={48}
          gap="$7"
          $md={{ flexDirection: "row", items: "flex-end", gap: "$8" }}
        >
          <YStack gap="$4" $md={{ flex: 1.6 }}>
            {/* Editorial mono kicker (was Tailwind font-mono/tracking utils). */}
            <Text
              fontFamily="$mono"
              fontSize={11}
              textTransform="uppercase"
              letterSpacing={3.5}
              color="$mutedForeground"
            >
              Plans
            </Text>
            {/* Responsive display heading (was a Tailwind clamp()). */}
            <H1
              fontSize={40}
              lineHeight={42}
              letterSpacing={-1}
              color="$color"
              $md={{ fontSize: 64, lineHeight: 62, letterSpacing: -1.6 }}
              $lg={{ fontSize: 80, lineHeight: 76, letterSpacing: -2 }}
              style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
            >
              Choose your plan
            </H1>
            <Paragraph maxW={576} fontSize="$5" color="$mutedForeground">
              Same Meridian, different limits. Upgrade or downgrade at any time
              — you can cancel from the billing page.
            </Paragraph>
          </YStack>
          <YStack
            gap="$4"
            items="flex-start"
            $md={{ flex: 1, items: "flex-end" }}
          >
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
        </YStack>

        {/* Plans */}
        {storeBilled ? (
          // Active plan is billed through the phone's app store — don't sell a
          // web (Polar) plan on top of it. Direct management to the device.
          <Banner intent="info">
            <Banner.Body>
              <Banner.Title>Your plan is managed on your phone</Banner.Title>
              <Banner.Description>
                You subscribed through the{" "}
                {sub?.provider === "play" ? "Google Play Store" : "App Store"}{" "}
                in the Meridian mobile app. To change or cancel this plan, open
                the app on your phone, or manage it in your device&apos;s
                subscription settings. Buying here would start a separate
                subscription.
              </Banner.Description>
            </Banner.Body>
          </Banner>
        ) : (
          <View position="relative">
            {/* Desktop-only register hairline the cards sit on. */}
            <View
              aria-hidden
              position="absolute"
              l={0}
              r={0}
              t="50%"
              mt={-0.5}
              z={0}
              height={1}
              bg="$borderColor"
              opacity={0.6}
              pointerEvents="none"
              display="none"
              $md={{ display: "flex" }}
            />

            {isLoading || !ordered || !features ? (
              <PlanGridSkeleton />
            ) : media.md ? (
              // md+ : flex grid. Cards flex to fill, wrapping below minWidth.
              // The featured card lifts via a negative margin (transform-free so
              // it never fights the enterStyle reveal).
              <XStack render="ul" position="relative" flexWrap="wrap" gap="$6">
                {ordered.map((plan, i) => (
                  <View
                    key={plan.id}
                    render="li"
                    flex={1}
                    minW={260}
                    enterStyle={{ opacity: 0, y: 14 }}
                    transition={["medium", { delay: i * 70 }]}
                    // Featured card lifts out of the row (this branch is md+ only).
                    mt={plan.isFeatured ? -24 : 0}
                  >
                    <PlanTierCard
                      plan={plan}
                      catalog={features}
                      cycle={cycle}
                      isCurrent={sub?.plan === plan.slug}
                    />
                  </View>
                ))}
              </XStack>
            ) : (
              // mobile : swipeable snap carousel. Fixed-width slides + a peek of
              // the next card signal "swipe for more"; the bar is hidden but the
              // surface scroll-snaps to each plan.
              <YStack gap="$3">
                <XStack
                  render="ul"
                  className="scrollbar-hide"
                  flexWrap="nowrap"
                  gap="$4"
                  pb="$2"
                  style={
                    {
                      overflowX: "auto",
                      overflowY: "hidden",
                      scrollSnapType: "x mandatory",
                      scrollPaddingLeft: 0,
                      WebkitOverflowScrolling: "touch",
                    } as object
                  }
                >
                  {ordered.map((plan, i) => (
                    <View
                      key={plan.id}
                      render="li"
                      width={280}
                      shrink={0}
                      enterStyle={{ opacity: 0, y: 14 }}
                      transition={["medium", { delay: i * 70 }]}
                      style={{ scrollSnapAlign: "start" } as object}
                    >
                      <PlanTierCard
                        plan={plan}
                        catalog={features}
                        cycle={cycle}
                        isCurrent={sub?.plan === plan.slug}
                      />
                    </View>
                  ))}
                </XStack>
                {ordered.length > 1 && (
                  <Text text="center" fontSize="$1" color="$mutedForeground">
                    Swipe to compare plans
                  </Text>
                )}
              </YStack>
            )}
          </View>
        )}

        {/* Comparison sheet */}
        {!storeBilled &&
          !isLoading &&
          ordered &&
          features &&
          features.length > 0 && (
            <View
              mt={96}
              enterStyle={{ opacity: 0, y: 14 }}
              transition="medium"
            >
              <ComparisonSheet plans={ordered} features={features} />
            </View>
          )}

        {/* Closing mark */}
        <XStack
          render="footer"
          mt={80}
          flexWrap="wrap"
          items="baseline"
          justify="space-between"
          gap="$4"
          borderTopWidth={1}
          borderColor="$borderColor"
          pt="$5"
        >
          <Text fontSize="$5" fontWeight="500">
            Questions about your plan?
          </Text>
          {/* Anchor (styled Text rendering <a>) — the v2 guide's
              replacement for tag="a". */}
          <Anchor
            href="mailto:hello@meridian.app"
            fontSize="$3"
            fontWeight="500"
            color="$color"
            textDecorationLine="none"
            hoverStyle={{ textDecorationLine: "underline" }}
            style={{ textUnderlineOffset: 4 } as object}
          >
            hello@meridian.app
          </Anchor>
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
    // Matches the live plan grid (flex, wraps to single-column on mobile).
    // Kit Skeleton carries the shimmer — no Tailwind animate-pulse.
    <XStack render="ul" flexWrap="wrap" gap="$5" $md={{ gap: "$6" }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} flex={1} minW={260} height={520} rounded={28} />
      ))}
    </XStack>
  );
}
