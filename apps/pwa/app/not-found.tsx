import Link from "next/link";
import { GoBackButton } from "@/components/shared/go-back-button";

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6">
      {/* Atmospheric background */}
      <div className="pointer-events-none absolute inset-0">
        {/* Slow-drifting grid */}
        <div
          className="absolute auth-showcase-grid opacity-40 dark:opacity-20"
          style={{ inset: "-40px" }}
        />

        {/* Meridian line — vertical accent */}
        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-primary/20 to-transparent" />

        {/* Glow orb */}
        <div className="absolute left-1/2 top-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.04] blur-[100px]" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex max-w-lg flex-col items-center text-center">
        {/* Large 404 display */}
        <div className="auth-animate auth-stagger-1">
          <p
            className="text-[10rem] leading-none font-bold tracking-tighter text-foreground/[0.06] select-none sm:text-[13rem]"
            style={{ fontFamily: "var(--font-display), var(--font-sans)" }}
          >
            404
          </p>
        </div>

        {/* Overlapping content card */}
        <div className="-mt-16 flex flex-col items-center gap-6 sm:-mt-20">
          {/* Compass icon */}
          <div className="auth-animate auth-stagger-2 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card shadow-lg shadow-black/5 dark:shadow-black/20">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-primary"
            >
              <circle cx="12" cy="12" r="10" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
            </svg>
          </div>

          {/* Copy */}
          <div className="auth-animate auth-stagger-3 flex flex-col items-center gap-2">
            <h1
              className="text-2xl font-semibold tracking-tight text-foreground"
              style={{ fontFamily: "var(--font-display), var(--font-sans)" }}
            >
              Off the meridian
            </h1>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              This page doesn&rsquo;t exist or has been moved. Let&rsquo;s get
              you back on track.
            </p>
          </div>

          {/* Actions */}
          <div className="auth-animate auth-stagger-4 flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Go home
            </Link>
            <GoBackButton />
          </div>
        </div>
      </div>

      {/* Subtle bottom watermark */}
      <div className="auth-animate auth-stagger-5 absolute bottom-8 text-xs text-muted-foreground/50">
        Meridian
      </div>
    </div>
  );
}
