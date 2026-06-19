const sizes = {
  xs: 28,
  sm: 32,
  md: 48,
  lg: 64,
} as const;

// Single colored brand mark on a TRUE transparent background (`meridian_mark.png`):
// only the gold/orange/red spiral rings are opaque — the inter-ring gaps, the
// center, and the surrounding area are all transparent, so the mark sits
// directly on whatever surface is behind it and reads cleanly on every theme.
// One image, no dark-mode swap.
//
// The other assets all bake in a solid tile and must NOT be used here:
//   meridian_light.png → white tile  (the bright box that looked wrong on the
//                                      dark sidebar — the bug this replaced)
//   meridian_dark.png  → navy tile   (blended into the sidebar, "disappeared")
//   meridian_black.png → black tile  /  meridian_white.png → mono mark
// They stay for favicons / app icons where a filled tile is wanted.
//
// Stays a native <img>: it's a leaf media element with no layout, color, or
// typography, and the kit `Image` is RN-based (`source`/`resizeMode`, not
// `src`), so a plain <img> is the right primitive here.
export function MeridianLogo({
  size = "md",
}: {
  size?: "xs" | "sm" | "md" | "lg";
}) {
  const px = sizes[size];
  return (
    <img src="/logo/meridian_mark.png" alt="Meridian" width={px} height={px} />
  );
}
