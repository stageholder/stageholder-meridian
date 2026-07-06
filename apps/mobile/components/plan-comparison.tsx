// apps/mobile/components/plan-comparison.tsx
//
// "Compare all features" — native port of the PWA ComparisonSheet's STACKED
// variant (apps/pwa/src/components/billing/comparison-sheet.tsx): one card
// per plan, features grouped by category, the value right-aligned on each
// row. The desktop side-by-side spec table isn't ported — a phone is always
// the PWA's `< md` case.
//
// Data comes from the Hub's pricing catalog (useHubPricing) — plan feature
// LIMITS are Hub truth regardless of biller. The purchasable prices above
// this section stay the store's localized prices (App Store / Play are the
// merchant of record on mobile), so this section deliberately shows no
// prices at all.

import type { PricingPlan, ProductFeature } from "@stageholder/sdk/spa";
import { Text, View, XStack, YStack } from "@stageholder/ui";
import { Check, Minus } from "@tamagui/lucide-icons-2";

export function PlanComparison({
  plans,
  features,
}: {
  plans: PricingPlan[];
  features: ProductFeature[];
}) {
  if (plans.length === 0 || features.length === 0) return null;

  const ordered = orderPlans(plans);
  const grouped = groupByCategory(features);

  return (
    <YStack gap="$4">
      {/* Section heading (mirrors the PWA's editorial header). */}
      <YStack
        gap="$1.5"
        borderBottomWidth={1}
        borderColor="$borderColor"
        pb="$3"
      >
        <Text
          fontSize="$6"
          fontWeight="700"
          letterSpacing={-0.4}
          color="$color"
        >
          Compare all features
        </Text>
        <Text fontSize="$3" color="$mutedForeground">
          What&rsquo;s included in each plan.
        </Text>
      </YStack>

      {ordered.map((p) => (
        <YStack
          key={p.id}
          gap="$4"
          rounded={20}
          borderWidth={1}
          borderColor={p.isFeatured ? "$color" : "$borderColor"}
          bg="$card"
          p="$4"
        >
          <YStack gap="$1">
            <Text
              fontSize="$6"
              fontWeight="600"
              letterSpacing={-0.4}
              color="$color"
            >
              {p.displayName}
            </Text>
            {p.isFeatured ? (
              <Text
                fontSize="$1"
                fontWeight="500"
                color="$mutedForeground"
                textTransform="uppercase"
                letterSpacing={0.5}
              >
                Most popular
              </Text>
            ) : null}
          </YStack>

          {grouped.map(([category, group]) => (
            <YStack key={category ?? "_uncat"} gap="$1">
              <Text
                mb="$1"
                fontSize="$1"
                fontWeight="600"
                color="$mutedForeground"
                textTransform="uppercase"
                letterSpacing={0.5}
              >
                {category ?? "Other"}
              </Text>
              {group.map((f) => (
                <XStack
                  key={f.id}
                  gap="$3"
                  py="$2.5"
                  borderTopWidth={1}
                  borderColor="$borderColor"
                  items="center"
                  justify="space-between"
                >
                  <YStack flex={1} minW={0} gap="$0.5">
                    <Text fontSize="$3" fontWeight="500" color="$color">
                      {f.displayName}
                    </Text>
                    {f.description ? (
                      <Text fontSize="$1" color="$mutedForeground">
                        {f.description}
                      </Text>
                    ) : null}
                  </YStack>
                  <View shrink={0} items="flex-end">
                    <Cell plan={p} feature={f} />
                  </View>
                </XStack>
              ))}
            </YStack>
          ))}
        </YStack>
      ))}
    </YStack>
  );
}

/** Render one plan's value for one feature — same rules as the PWA Cell. */
function Cell({
  plan,
  feature,
}: {
  plan: PricingPlan;
  feature: ProductFeature;
}) {
  const value = (plan.features ?? {})[feature.slug];

  if (feature.valueType === "boolean") {
    if (value === true) {
      return (
        <View
          width={16}
          height={16}
          items="center"
          justify="center"
          rounded={9999}
          bg="$color"
        >
          <Check size={10} strokeWidth={3} color="$background" />
        </View>
      );
    }
    return <Minus size={12} strokeWidth={2} color="$mutedForeground" />;
  }
  if (feature.valueType === "number") {
    // `null` number = unlimited (Hub catalog convention).
    if (value === null) {
      return (
        <Text fontSize="$3" fontWeight="500" color="$color">
          Unlimited
        </Text>
      );
    }
    if (typeof value === "number") {
      return (
        <Text fontSize="$3" fontWeight="500" color="$color">
          {value.toLocaleString()}
          {feature.unit ? (
            <Text fontSize="$1" color="$mutedForeground">
              {" "}
              {feature.unit}
            </Text>
          ) : null}
        </Text>
      );
    }
    return <Minus size={12} strokeWidth={2} color="$mutedForeground" />;
  }
  if (
    feature.valueType === "text" &&
    typeof value === "string" &&
    value.length > 0
  ) {
    return (
      <Text fontSize="$3" color="$color">
        {value}
      </Text>
    );
  }
  return <Minus size={12} strokeWidth={2} color="$mutedForeground" />;
}

/** Free first, then ascending price — same ordering as the PWA upgrade page,
 *  so the stacked cards read cheapest → most expensive. */
function orderPlans(plans: PricingPlan[]): PricingPlan[] {
  return [...plans].sort((a, b) => {
    if (a.isFreeTier && !b.isFreeTier) return -1;
    if (!a.isFreeTier && b.isFreeTier) return 1;
    const ap = a.priceMonthly ?? Number.POSITIVE_INFINITY;
    const bp = b.priceMonthly ?? Number.POSITIVE_INFINITY;
    return ap - bp;
  });
}

function groupByCategory(
  features: ProductFeature[],
): Array<[string | null, ProductFeature[]]> {
  const map = new Map<string | null, ProductFeature[]>();
  const sorted = [...features].sort(
    (a, b) =>
      a.sortOrder - b.sortOrder || a.displayName.localeCompare(b.displayName),
  );
  for (const f of sorted) {
    const k = f.category ?? null;
    const arr = map.get(k) ?? [];
    arr.push(f);
    map.set(k, arr);
  }
  return Array.from(map.entries());
}
