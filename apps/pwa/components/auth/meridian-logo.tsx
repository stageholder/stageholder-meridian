import Image from "next/image";
import { cn } from "@/lib/utils";

const sizes = {
  sm: { className: "w-8 h-8", px: 32 },
  md: { className: "w-12 h-12", px: 48 },
  lg: { className: "w-16 h-16", px: 64 },
} as const;

export function MeridianLogo({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const s = sizes[size];
  return (
    <Image
      src="/logo/meridian_light.png"
      alt="Meridian"
      width={s.px}
      height={s.px}
      className={cn(s.className, className)}
      priority
    />
  );
}
