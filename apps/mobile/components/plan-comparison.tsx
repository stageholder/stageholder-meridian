// apps/mobile/components/plan-comparison.tsx
//
// "Compare all features" — a compact SIDE-BY-SIDE table: one column per plan,
// one row per feature, grouped by category. Replaces the earlier stacked
// one-card-per-plan port of the PWA ComparisonSheet (which repeated every
// feature row per plan and ran several screens tall on a phone). A phone
// comfortably fits a label column plus two narrow value columns, which is
// what Meridian sells (Free vs Unlimited); the value columns shrink to fit
// if the catalog ever grows a third plan.
//
// Data comes from the Hub's pricing catalog (useHubPricing) — plan feature
// LIMITS are Hub truth regardless of biller. The purchasable prices above
// this section stay the store's localized prices (App Store / Play are the
// merchant of record on mobile), so this section deliberately shows no
// prices at all.

import type { PricingPlan, ProductFeature } from "@stageholder/sdk/spa";
import { Text, View, XStack, YStack } from "@stageholder/ui";
import { Check } from "@tamagui/lucide-icons-2/icons/Check";
import { Minus } from "@tamagui/lucide-icons-2/icons/Minus";

/** Width of each plan column (two of them must fit beside the label). */
const PLAN_COL_WIDTH = 84;

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
  // Three or more plans: narrow the columns so the label keeps room.
  const colWidth =
    ordered.length > 2
      ? Math.floor((PLAN_COL_WIDTH * 2) / ordered.length)
      : PLAN_COL_WIDTH;

  return (
    <YStack gap="$4">
      {/* Section heading (mirrors the PWA's editorial header). */}
      <YStack gap="$1.5">
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

      <YStack
        rounded={20}
        borderWidth={1}
        borderColor="$borderColor"
        bg="$card"
        overflow="hidden"
      >
        {/* Header row: plan names over their columns. */}
        <XStack
          items="flex-end"
          px="$4"
          pt="$4"
          pb="$3"
          borderBottomWidth={1}
          borderColor="$borderColor"
          gap="$2"
        >
          <View flex={1} minW={0} />
          {ordered.map((p) => (
            <YStack key={p.id} width={colWidth} items="center" gap="$0.5">
              <Text
                fontSize="$3"
                fontWeight="600"
                color="$color"
                text="center"
                numberOfLines={1}
              >
                {p.displayName}
              </Text>
              {p.isFeatured ? (
                <Text
                  fontSize={10}
                  fontWeight="500"
                  color="$mutedForeground"
                  textTransform="uppercase"
                  letterSpacing={0.5}
                >
                  Popular
                </Text>
              ) : null}
            </YStack>
          ))}
        </XStack>

        {grouped.map(([category, group], gi) => (
          <YStack key={category ?? "_uncat"}>
            {/* An uncategorised catalog is one flat list — no "Other" label. */}
            {category !== null || grouped.length > 1 ? (
              <Text
                px="$4"
                pt={gi === 0 ? "$3" : "$4"}
                pb="$1"
                fontSize="$1"
                fontWeight="600"
                color="$mutedForeground"
                textTransform="uppercase"
                letterSpacing={0.5}
              >
                {category ?? "Other"}
              </Text>
            ) : (
              <View height="$2" />
            )}
            {group.map((f, i) => (
              <XStack
                key={f.id}
                px="$4"
                py="$2.5"
                gap="$2"
                items="center"
                borderTopWidth={i === 0 ? 0 : 1}
                borderColor="$borderColor"
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
                {ordered.map((p) => (
                  <View
                    key={p.id}
                    width={colWidth}
                    items="center"
                    justify="center"
                  >
                    <Cell plan={p} feature={f} />
                  </View>
                ))}
              </XStack>
            ))}
          </YStack>
        ))}
        <View height="$2" />
      </YStack>
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
          width={18}
          height={18}
          items="center"
          justify="center"
          rounded={9999}
          bg="$color"
        >
          <Check size={11} strokeWidth={3} color="$background" />
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
        <Text fontSize="$3" fontWeight="500" color="$color" text="center">
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
      <Text fontSize="$3" color="$color" text="center">
        {value}
      </Text>
    );
  }
  return <Minus size={12} strokeWidth={2} color="$mutedForeground" />;
}

/** Free first, then ascending price — same ordering as the PWA upgrade page,
 *  so the columns read cheapest → most expensive left to right. */
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
