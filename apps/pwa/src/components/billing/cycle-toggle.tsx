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
  return (
    <SegmentedControl
      value={value}
      onValueChange={(next) => onChange(next as "monthly" | "yearly")}
      aria-label="Billing cycle"
    >
      <SegmentedControl.Item value="monthly">Monthly</SegmentedControl.Item>
      <SegmentedControl.Item value="yearly">
        <XStack items="center" gap="$2">
          <Text>Yearly</Text>
          {yearlyDiscountLabel ? (
            <Text
              rounded={9999}
              px="$2"
              py="$0.5"
              fontSize="$1"
              fontWeight="600"
              bg="$primaryMuted"
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
