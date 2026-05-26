const sizes = {
  xs: 28,
  sm: 32,
  md: 48,
  lg: 64,
} as const;

// Single colored brand mark on a transparent background. The colorful spiral
// reads cleanly on both light and dark surfaces, so we use one image for
// every theme — no dark-mode swap. (The previous `meridian_dark.png` was a
// spiral on a dark navy tile that blended into the dark sidebar and looked
// like it had disappeared.)
//
// Stays a native <img>: it's a leaf media element with no layout, color, or
// typography, and the kit `Image` is RN-based (`source`/`resizeMode`, not
// `src`), so a plain <img> is the right primitive here.
export function MeridianLogo({
  size = "md",
  className,
}: {
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const px = sizes[size];
  return (
    <img
      src="/logo/meridian_light.png"
      alt="Meridian"
      width={px}
      height={px}
      className={className}
    />
  );
}
