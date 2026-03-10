import { Suspense } from "react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Meridian</h1>
          <p className="mt-2 text-sm text-muted-foreground">Your personal productivity companion</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
          <Suspense>{children}</Suspense>
        </div>
      </div>
    </div>
  );
}
