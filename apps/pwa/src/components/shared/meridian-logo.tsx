const sizes = {
  xs: 28,
  sm: 32,
  md: 48,
  lg: 64,
} as const;

// Theme-aware brand mark. `meridian_light.png` is the transparent-BG
// colored spiral; `meridian_dark.png` is the same spiral on a dark navy
// rounded tile so it reads cleanly on dark surfaces. Both are rendered
// and toggled via Tailwind's `dark:` variant so we don't need to read
// theme state from React (next-themes adds `class="dark"` to <html>).
//
// Stays a native <img>: it is a leaf media element carrying no layout,
// color, or typography, and the `dark:`/`block`/`hidden` theme toggle has
// no Tamagui token equivalent (the kit `Image` is RN-based: `source`/
// `resizeMode`, not `src`/`dark:`).
export function MeridianLogo({
  size = "md",
  className,
}: {
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const px = sizes[size];
  const extra = className ? ` ${className}` : "";
  return (
    <>
      <img
        src="/logo/meridian_light.png"
        alt="Meridian"
        width={px}
        height={px}
        className={`block dark:hidden${extra}`}
      />
      <img
        src="/logo/meridian_dark.png"
        alt=""
        aria-hidden
        width={px}
        height={px}
        className={`hidden dark:block${extra}`}
      />
    </>
  );
}
