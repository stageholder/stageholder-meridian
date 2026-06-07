import { Text, View, YStack } from "@stageholder/ui";

/**
 * Branded atmospheric shell for Meridian's auth-adjacent surfaces —
 * sign-in (desktop), sign-in errors, goodbye. Mirrors the full-bleed
 * treatment on the root `/not-found` page so the brand identity carries
 * through every entry/exit point Meridian still renders (the actual
 * login form lives on the Hub; these screens wrap the redirects).
 *
 * Slow-drifting grid + vertical meridian line + primary glow orb, with
 * the content floating above on a transparent layer. Animations use the
 * `auth-animate` + `auth-stagger-*` classes from globals.css, which
 * already honor `prefers-reduced-motion`.
 *
 * Children should be wrapped in individual `<div className="auth-animate
 * auth-stagger-N">` blocks to get the staggered reveal.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <YStack
      position="relative"
      minH={"100vh" as never}
      items="center"
      justify="center"
      overflow="hidden"
      bg="$background"
      px="$6"
    >
      {/* Atmospheric background */}
      <View position="absolute" t={0} b={0} l={0} r={0} pointerEvents="none">
        {/* allowlist: auth-showcase-grid drift keyframe (globals.css). The
            light/dark opacity split is a Tamagui theme variant now. */}
        <View
          position="absolute"
          className="auth-showcase-grid"
          opacity={0.4}
          $theme-dark={{ opacity: 0.2 }}
          style={{ inset: "-40px" }}
        />
        {/* Vertical meridian line — CSS gradient (web-only, no token
            equivalent) rides the style hatch. */}
        <View
          position="absolute"
          t={0}
          height="100%"
          width={1}
          l="50%"
          style={
            {
              transform: "translateX(-50%)",
              background:
                "linear-gradient(to bottom, transparent, color-mix(in srgb, var(--primary) 20%, transparent), transparent)",
            } as object
          }
        />
        {/* Primary glow orb — translucency + heavy blur (web-only CSS) rides
            the style hatch. */}
        <View
          position="absolute"
          t="50%"
          l="50%"
          height={480}
          width={480}
          rounded={9999}
          style={
            {
              transform: "translate(-50%, -50%)",
              backgroundColor:
                "color-mix(in srgb, var(--primary) 4%, transparent)",
              filter: "blur(100px)",
            } as object
          }
        />
      </View>

      {/* Content */}
      <YStack position="relative" z={10} maxW={448} items="center">
        {children}
      </YStack>

      {/* Brand watermark */}
      {/* allowlist: auth-animate + auth-stagger-8 keyframes (globals.css) */}
      <Text
        position="absolute"
        b="$6"
        fontSize="$1"
        color="$mutedForeground"
        opacity={0.5}
        className="auth-animate auth-stagger-8"
      >
        Meridian
      </Text>
    </YStack>
  );
}
