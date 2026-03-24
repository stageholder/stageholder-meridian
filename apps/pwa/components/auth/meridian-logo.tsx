import { cn } from "@/lib/utils";

const sizes = {
  sm: "w-8 h-8",
  md: "w-12 h-12",
  lg: "w-16 h-16",
} as const;

export function MeridianLogo({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(sizes[size], className)}
    >
      {/* Outer ring — journal (warm gold) */}
      <circle
        cx="24"
        cy="24"
        r="22"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeOpacity="0.25"
      />

      {/* Middle ring — habit (amber) */}
      <circle
        cx="24"
        cy="24"
        r="17"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeOpacity="0.18"
      />

      {/* Inner ring — todo (coral) */}
      <circle
        cx="24"
        cy="24"
        r="12"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.12"
      />

      {/* Three activity arcs — the product identity */}
      {/* Outer arc — journal */}
      <path
        d="M24 2 A22 22 0 0 1 46 24"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeOpacity="0.85"
      />

      {/* Middle arc — habit */}
      <path
        d="M24 7 A17 17 0 0 1 41 24"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeOpacity="0.6"
      />

      {/* Inner arc — todo */}
      <path
        d="M24 12 A12 12 0 0 1 36 24"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeOpacity="0.4"
      />

      {/* Meridian line — vertical axis */}
      <line
        x1="24"
        y1="2"
        x2="24"
        y2="46"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.1"
      />

      {/* Horizon line */}
      <line
        x1="2"
        y1="24"
        x2="46"
        y2="24"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.1"
      />

      {/* Center point — convergence */}
      <circle cx="24" cy="24" r="3" fill="currentColor" opacity="0.9" />
      <circle
        cx="24"
        cy="24"
        r="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.5"
        strokeOpacity="0.3"
      />

      {/* North marker — direction */}
      <circle cx="24" cy="4" r="1.5" fill="currentColor" opacity="0.7" />
    </svg>
  );
}
