"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { setLoggedInFlag } from "@/lib/auth-helpers";
import { useAuthStore } from "@/stores/auth-store";

function CallbackHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    const userParam = searchParams.get("user");
    const redirect = searchParams.get("redirect") || "/workspaces";

    if (userParam) {
      try {
        const user = JSON.parse(userParam);
        setUser(user);
        setLoggedInFlag();
      } catch {
        // ignore parse errors
      }
    }

    router.replace(redirect);
  }, [searchParams, setUser, router]);

  return null;
}

export default function GoogleCallbackPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">Signing you in...</p>
      <Suspense>
        <CallbackHandler />
      </Suspense>
    </div>
  );
}
