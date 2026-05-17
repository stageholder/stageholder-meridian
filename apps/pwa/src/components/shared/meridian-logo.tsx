import { cn } from "@/lib/utils";

const sizes = {
  xs: { className: "w-7 h-7", px: 28 },
  sm: { className: "w-8 h-8", px: 32 },
  md: { className: "w-12 h-12", px: 48 },
  lg: { className: "w-16 h-16", px: 64 },
} as const;

// Theme-aware brand mark. `meridian_light.png` is the transparent-BG
// colored spiral; `meridian_dark.png` is the same spiral on a dark navy
// rounded tile so it reads cleanly on dark surfaces. Both are rendered
// and toggled via Tailwind's `dark:` variant so we don't need to read
// theme state from React (next-themes adds `class="dark"` to <html>).
export function MeridianLogo({
  size = "md",
  className,
}: {
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const s = sizes[size];
  return (
    <>
      <img
        src="/logo/meridian_light.png"
        alt="Meridian"
        width={s.px}
        height={s.px}
        className={cn(s.className, "block dark:hidden", className)}
      />
      <img
        src="/logo/meridian_dark.png"
        alt=""
        aria-hidden
        width={s.px}
        height={s.px}
        className={cn(s.className, "hidden dark:block", className)}
      />
    </>
  );
}
