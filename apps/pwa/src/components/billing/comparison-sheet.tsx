import type { PricingPlan, ProductFeature } from "@stageholder/sdk/spa";
import { Check, Minus } from "lucide-react";
import { H2, Text, View, YStack } from "@stageholder/ui";

/**
 * Spec-sheet style comparison table. Reads like a printed datasheet —
 * monospaced category labels, hairline rules, no zebra rows, just type
 * and rules doing the work. Sticky header column lets the values scroll
 * laterally on narrow viewports without losing context.
 *
 * The `<table>` subtree stays real HTML: sticky-left feature column +
 * horizontal scroll + variable column widths + rowspan have no kit `Table`
 * equivalent (its cells are equal-flex), so the structural wrappers are
 * Tamagui primitives and the table semantics/layout classes are kept as a
 * functional unit. Cell typography/color is carried by nested `<Text>`.
 */
export function ComparisonSheet({
  plans,
  features,
}: {
  plans: PricingPlan[];
  features: ProductFeature[];
}) {
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

      {/* allowlist: overflow-x-auto — horizontal scroll for the wide spec
          table on narrow viewports; the sticky-left column needs the
          scroll container as its positioning context. */}
      <View mx={-8} pb="$4" className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-[34%] bg-background px-3 pb-4 text-left">
                <Text
                  fontSize="$1"
                  fontWeight="500"
                  color="$mutedForeground"
                  textTransform="uppercase"
                  letterSpacing={0.5}
                >
                  Feature
                </Text>
              </th>
              {plans.map((p) => (
                <th
                  key={p.id}
                  className="w-auto px-3 pb-4 text-left align-bottom"
                >
                  <YStack gap="$1">
                    <Text
                      fontSize="$5"
                      lineHeight={16}
                      letterSpacing={-0.3}
                      color="$color"
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 600,
                      }}
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
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {grouped.map(([category, group]) => (
              <CategoryRows
                key={category ?? "_uncat"}
                category={category}
                group={group}
                plans={plans}
              />
            ))}
          </tbody>
        </table>
      </View>
    </View>
  );
}

function CategoryRows({
  category,
  group,
  plans,
}: {
  category: string | null;
  group: ProductFeature[];
  plans: PricingPlan[];
}) {
  return (
    <>
      <tr>
        <td
          colSpan={1 + plans.length}
          className="border-t-2 border-foreground/40 px-3 pt-7"
        >
          <Text
            fontSize="$1"
            fontWeight="600"
            color="$color"
            textTransform="uppercase"
            letterSpacing={0.5}
          >
            {category ?? "Other"}
          </Text>
        </td>
      </tr>
      {group.map((f) => (
        // allowlist: group/row + group-hover:bg — per-row hover tint on the
        // sticky-table cells, which are HTML <td> (no Tamagui hoverStyle).
        <tr key={f.id} className="group/row">
          <th
            scope="row"
            className="sticky left-0 z-10 bg-background px-3 py-3 text-left align-top border-t border-border/60"
          >
            <YStack gap="$0.5">
              <Text fontSize="$3" fontWeight="500" color="$color">
                {f.displayName}
              </Text>
              {f.description && (
                <Text fontSize="$1" color="$mutedForeground">
                  {f.description}
                </Text>
              )}
            </YStack>
          </th>
          {plans.map((p) => (
            <td
              key={p.id}
              className="px-3 py-3 align-top border-t border-border/60 transition-colors duration-200 group-hover/row:bg-foreground/3"
            >
              <Cell plan={p} feature={f} />
            </td>
          ))}
        </tr>
      ))}
    </>
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
          {feature.unit && (
            <Text ml="$1" fontSize="$1" color="$mutedForeground">
              {feature.unit}
            </Text>
          )}
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
