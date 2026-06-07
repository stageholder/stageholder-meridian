import { Plus } from "@tamagui/lucide-icons-2";
import { FAB, View } from "@stageholder/ui";

/**
 * Mobile-only floating "create" button (kit `FAB`). On desktop the inline
 * "New …" buttons / quick-add composer stay; on mobile they're hidden and this
 * FAB takes over as the single create affordance.
 *
 * Positioned bottom-right ABOVE the floating BottomNav capsule (~78px + the iOS
 * home-indicator inset) with a gap, so the two never overlap. `position:fixed`
 * anchors it to the viewport even though it renders deep inside a scroll
 * container — same `as never` cast the BottomNav uses (Tamagui's position type
 * omits the web "fixed" value). The bottom inset uses a Tailwind arbitrary
 * value because `env(safe-area-inset-bottom)` has no design token.
 *
 * `tintVar` paints the FAB in a feature color (the same `--ring-*` CSS vars the
 * inline buttons use) so the create affordance keeps its per-feature identity;
 * omit it for the default `$primary`.
 */
export function CreateFab({
  onPress,
  label,
  tintVar,
  iconColor = "white",
}: {
  onPress: () => void;
  /** Accessible name for the button. */
  label: string;
  /** CSS var for the feature color, e.g. "--ring-habit". Omit for `$primary`. */
  tintVar?: string;
  iconColor?: string;
}) {
  const tint = tintVar
    ? ({
        style: { backgroundColor: `var(${tintVar})` },
        // Keep the feature color on hover (the kit FAB would otherwise flip to
        // $primaryHover); press scale/opacity comes from the FAB's usePressScale.
        hoverStyle: {
          backgroundColor: `var(${tintVar})`,
          opacity: 0.92,
        } as never,
      } as object)
    : {};

  return (
    <View
      position={"fixed" as never}
      r={20}
      z={40}
      // env() safe-area inset clears the bottom nav — web-only CSS value, so
      // it rides the prop as a raw string (same idiom as position="fixed").
      b={"calc(6rem + env(safe-area-inset-bottom, 0px))" as never}
      $md={{ display: "none" }}
    >
      <FAB
        icon={<Plus size={24} color={iconColor as never} />}
        onPress={onPress}
        aria-label={label}
        {...tint}
      />
    </View>
  );
}
