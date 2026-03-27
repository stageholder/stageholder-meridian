import { MeridianLogo } from "./meridian-logo";

export function AuthFormWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen lg:min-h-0 p-6 lg:p-12 bg-background">
      {/* Mobile branding — hidden on desktop where showcase panel handles it */}
      <div className="flex flex-col items-center gap-2 mb-8 lg:hidden auth-animate auth-stagger-1">
        <MeridianLogo size="md" />
        <h1 className="text-2xl font-[family-name:var(--font-display)] tracking-tight font-semibold">
          Meridian
        </h1>
        <p className="text-sm text-muted-foreground">
          Your personal productivity companion
        </p>
      </div>

      <div className="w-full max-w-[420px]">{children}</div>
    </div>
  );
}
