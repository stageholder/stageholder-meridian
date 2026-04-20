import Link from "next/link";
import { GoBackButton } from "@/components/shared/go-back-button";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6">
      <div className="flex max-w-sm flex-col items-center text-center">
        {/* Icon */}
        <div className="auth-animate auth-stagger-1 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card shadow-lg shadow-black/5 dark:shadow-black/20">
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
            className="text-muted-foreground"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
            <path d="M8 11h6" />
          </svg>
        </div>

        {/* Copy */}
        <div className="auth-animate auth-stagger-2 mt-6 flex flex-col items-center gap-2">
          <h1
            className="text-xl font-semibold tracking-tight text-foreground"
            style={{ fontFamily: "var(--font-display), var(--font-sans)" }}
          >
            Page not found
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            This page doesn&rsquo;t exist. It may have been removed or the link
            might be incorrect.
          </p>
        </div>

        {/* Actions */}
        <div className="auth-animate auth-stagger-3 mt-6 flex items-center gap-3">
          <GoBackButton />
        </div>
      </div>
    </div>
  );
}
