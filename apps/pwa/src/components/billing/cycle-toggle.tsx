import { SegmentedControl, Text, XStack } from "@stageholder/ui";

/**
 * Segmented monthly / yearly toggle. Built on the kit's SegmentedControl,
 * whose absolute-positioned indicator slides between segments (the same
 * "printer's mark" affordance the bespoke version hand-rolled). Used on the
 * upgrade page above the plan grid.
 */
export function CycleToggle({
  value,
  onChange,
  yearlyDiscountLabel,
}: {
  value: "monthly" | "yearly";
  onChange: (next: "monthly" | "yearly") => void;
  /**
   * Optional micro-copy attached to the yearly segment, e.g. "save 16%".
   * Rendered in monospaced uppercase as a vintage callout.
   */
  yearlyDiscountLabel?: string;
}) {
  // The kit applies its `selected` color to a segment's label automatically,
  // but only when the child is a plain string. The Yearly segment wraps its
  // label + badge in an XStack, so the nested <Text>s keep their own color and
  // wouldn't flip when the indicator slides under them. We already know the
  // selection here (`value`), so colour them to match the kit's scheme.
  const yearlySelected = value === "yearly";
  return (
    <SegmentedControl
      pill
      value={value}
      onValueChange={(next) => onChange(next as "monthly" | "yearly")}
      aria-label="Billing cycle"
    >
      <SegmentedControl.Item value="monthly">Monthly</SegmentedControl.Item>
      <SegmentedControl.Item value="yearly">
        <XStack items="center" gap="$2">
          <Text
            fontWeight={yearlySelected ? "600" : "500"}
            color={yearlySelected ? "$primaryForeground" : "$mutedForeground"}
          >
            Yearly
          </Text>
          {yearlyDiscountLabel ? (
            <Text
              rounded={9999}
              px="$2"
              py="$0.5"
              fontSize="$1"
              fontWeight="600"
              // On the $primary indicator (selected) a $primaryMuted chip is
              // near-invisible — flip to a $primaryForeground chip so it reads
              // on the pill; keep the muted chip on the $accent track at rest.
              bg={yearlySelected ? "$primaryForeground" : "$primaryMuted"}
              color="$primary"
            >
              {yearlyDiscountLabel}
            </Text>
          ) : null}
        </XStack>
      </SegmentedControl.Item>
    </SegmentedControl>
  );
}
