import { Text, View, XStack } from "@stageholder/ui";

/**
 * Monthly / yearly billing-cycle toggle. A clean custom segmented control (the
 * kit SegmentedControl's bright-primary fill + a badge crammed *inside* the
 * yearly segment read as broken — the chip overflowed the pill and wrapped).
 * Here the toggle is a quiet two-pill track and the savings callout sits
 * OUTSIDE it, to the right, where it has room and reads as a reward.
 */
export function CycleToggle({
  value,
  onChange,
  yearlyDiscountLabel,
}: {
  value: "monthly" | "yearly";
  onChange: (next: "monthly" | "yearly") => void;
  /** e.g. "Save 18%" — shown as a standalone badge beside the toggle. */
  yearlyDiscountLabel?: string;
}) {
  const options = [
    { key: "monthly", label: "Monthly" },
    { key: "yearly", label: "Yearly" },
  ] as const;

  return (
    // Relative wrapper sized to the pill so the savings badge can float on its
    // top-right corner (sticker style). No `self` override — it inherits the
    // host column's alignment (right on desktop, left on mobile); forcing
    // flex-start here is what made the toggle sit inset from the right edge
    // while the note beside it right-aligned.
    <View position="relative">
      <XStack
        items="center"
        gap={3}
        p={3}
        rounded={9999}
        bg="$muted"
        borderWidth={1}
        borderColor="$borderColor"
      >
        {options.map(({ key, label }) => {
          const active = value === key;
          return (
            <View
              key={key}
              role="button"
              aria-label={label}
              onPress={() => onChange(key)}
              cursor="pointer"
              px="$4"
              py="$1.5"
              rounded={9999}
              transition="quick"
              bg={(active ? "$background" : "transparent") as never}
              // Raised "thumb" feel only on the active pill; the inactive cell
              // brightens its label on hover instead of shifting the track.
              {...(active
                ? { style: { boxShadow: "0 1px 3px rgba(0,0,0,0.18)" } }
                : { hoverStyle: { opacity: 0.85 } as never })}
            >
              <Text
                fontSize="$2"
                fontWeight={active ? "600" : "500"}
                color={active ? "$color" : "$mutedForeground"}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </XStack>

      {yearlyDiscountLabel ? (
        // SOLID success pill (the old $successMuted was translucent → the
        // "Yearly" label bled through it). Lifted fully above the pill's top
        // edge so it floats clear of the labels instead of overlapping them.
        <XStack
          position="absolute"
          t={-15}
          r={-8}
          z={1}
          items="center"
          rounded={9999}
          px="$2"
          py="$0.5"
          bg="$success"
          style={{ boxShadow: "0 3px 10px rgba(0,0,0,0.28)" }}
        >
          <Text
            fontSize={10}
            fontWeight="700"
            color={"#ffffff" as never}
            numberOfLines={1}
          >
            {yearlyDiscountLabel}
          </Text>
        </XStack>
      ) : null}
    </View>
  );
}
