import type { PricingPlan, ProductFeature } from "@stageholder/sdk/spa";
import { Check, Minus } from "lucide-react";
import { H2, Text, View, XStack, YStack, useMedia } from "@stageholder/ui";

/**
 * Feature comparison. Two layouts, picked by breakpoint — no raw <table>,
 * no horizontal scroll, no Tailwind:
 *   - mobile (`< md`): one card per plan, features grouped by category with
 *     the value right-aligned. The best-practice mobile pattern (no tiny
 *     sideways-scrolling grid).
 *   - `md+`: a real side-by-side spec sheet built from flex rows (feature
 *     column + one equal column per plan), grouped by category.
 *
 * Both share the `Cell` value renderer and the `groupByCategory` grouping.
 */
export function ComparisonSheet({
  plans,
  features,
}: {
  plans: PricingPlan[];
  features: ProductFeature[];
}) {
  const media = useMedia();
  if (plans.length === 0 || features.length === 0) return null;

  const grouped = groupByCategory(features);

  return (
    <View position="relative">
      {/* Section heading */}
      <YStack
        mb="$6"
        gap="$3"
        borderBottomWidth={1}
        borderColor="$borderColor"
        pb="$3"
      >
        <H2
          fontSize="$8"
          letterSpacing={-0.5}
          // Display serif lives only as a CSS var (no kit font token).
          style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
        >
          Compare all features
        </H2>
        <Text fontSize="$3" color="$mutedForeground">
          Side-by-side breakdown of what&rsquo;s included in each plan.
        </Text>
      </YStack>

      {media.md ? (
        <ComparisonTable plans={plans} grouped={grouped} />
      ) : (
        <ComparisonStacked plans={plans} grouped={grouped} />
      )}
    </View>
  );
}

type Grouped = Array<[string | null, ProductFeature[]]>;

/* ── md+ : side-by-side flex spec sheet ─────────────────────────────────── */

function ComparisonTable({
  plans,
  grouped,
}: {
  plans: PricingPlan[];
  grouped: Grouped;
}) {
  return (
    <YStack>
      {/* Header row */}
      <XStack
        gap="$4"
        pb="$3"
        borderBottomWidth={2}
        borderColor="$color"
        items="flex-end"
      >
        <View flex={1.5} minW={0}>
          <Text
            fontSize="$1"
            fontWeight="500"
            color="$mutedForeground"
            textTransform="uppercase"
            letterSpacing={0.5}
          >
            Feature
          </Text>
        </View>
        {plans.map((p) => (
          <YStack key={p.id} flex={1} minW={0} gap="$1">
            <Text
              fontSize="$5"
              letterSpacing={-0.3}
              color="$color"
              style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
            >
              {p.displayName}
            </Text>
            {p.isFeatured && (
              <Text
                fontSize="$1"
                fontWeight="500"
                color="$mutedForeground"
                textTransform="uppercase"
                letterSpacing={0.5}
              >
                Most popular
              </Text>
            )}
          </YStack>
        ))}
      </XStack>

      {grouped.map(([category, group]) => (
        <YStack key={category ?? "_uncat"}>
          {/* Category label */}
          <View pt="$6" pb="$2">
            <Text
              fontSize="$1"
              fontWeight="600"
              color="$color"
              textTransform="uppercase"
              letterSpacing={0.5}
            >
              {category ?? "Other"}
            </Text>
          </View>
          {group.map((f) => (
            <XStack
              key={f.id}
              gap="$4"
              py="$3"
              borderTopWidth={1}
              borderColor="$borderColor"
              items="flex-start"
              transition="quick"
              hoverStyle={{ bg: "$muted" }}
            >
              <YStack flex={1.5} minW={0} gap="$0.5">
                <Text fontSize="$3" fontWeight="500" color="$color">
                  {f.displayName}
                </Text>
                {f.description ? (
                  <Text fontSize="$1" color="$mutedForeground">
                    {f.description}
                  </Text>
                ) : null}
              </YStack>
              {plans.map((p) => (
                <View key={p.id} flex={1} minW={0}>
                  <Cell plan={p} feature={f} />
                </View>
              ))}
            </XStack>
          ))}
        </YStack>
      ))}
    </YStack>
  );
}

/* ── mobile : one card per plan ─────────────────────────────────────────── */

function ComparisonStacked({
  plans,
  grouped,
}: {
  plans: PricingPlan[];
  grouped: Grouped;
}) {
  return (
    <YStack gap="$5">
      {plans.map((p) => (
        <YStack
          key={p.id}
          gap="$4"
          rounded={20}
          borderWidth={1}
          borderColor={p.isFeatured ? "$color" : "$borderColor"}
          bg="$card"
          p="$5"
        >
          <YStack gap="$1">
            <Text
              fontSize="$7"
              letterSpacing={-0.4}
              color="$color"
              style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}
            >
              {p.displayName}
            </Text>
            {p.isFeatured && (
              <Text
                fontSize="$1"
                fontWeight="500"
                color="$mutedForeground"
                textTransform="uppercase"
                letterSpacing={0.5}
              >
                Most popular
              </Text>
            )}
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
          <Text color="$background" lineHeight={0}>
            <Check size={10} strokeWidth={3} />
          </Text>
        </View>
      );
    }
    return (
      <Text color="$mutedForeground" lineHeight={0}>
        <Minus size={12} strokeWidth={2} />
      </Text>
    );
  }
  if (feature.valueType === "number") {
    if (value === null)
      return (
        <Text fontSize="$3" fontWeight="500" color="$color">
          Unlimited
        </Text>
      );
    if (typeof value === "number") {
      return (
        <Text fontSize="$3" fontWeight="500" color="$color">
          {value.toLocaleString()}
          {feature.unit ? (
            <Text ml="$1" fontSize="$1" color="$mutedForeground">
              {feature.unit}
            </Text>
          ) : null}
        </Text>
      );
    }
    return (
      <Text color="$mutedForeground" lineHeight={0}>
        <Minus size={12} strokeWidth={2} />
      </Text>
    );
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
  return (
    <Text color="$mutedForeground" lineHeight={0}>
      <Minus size={12} strokeWidth={2} />
    </Text>
  );
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
