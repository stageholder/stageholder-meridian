"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { setLoggedInFlag } from "@/lib/auth-helpers";

function checkIsDesktop() {
  return (
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
  );
}

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

const OAUTH_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const OAUTH_SUCCESS_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Sign-in Successful</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; background: #fafafa; color: #111;
    }
    .card {
      text-align: center; padding: 48px; background: #fff;
      border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      max-width: 400px;
    }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
    p { font-size: 14px; color: #666; line-height: 1.5; }
    .hint { margin-top: 16px; font-size: 13px; color: #999; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#10003;</div>
    <h1>Sign-in successful</h1>
    <p>You've been authenticated. You can close this tab and return to Meridian.</p>
    <p class="hint">This tab will not be used again.</p>
  </div>
  <script>setTimeout(()=>window.close(),1500)</script>
</body>
</html>`;

export function GoogleSignInButton() {
  const [loading, setLoading] = useState(false);
  const setUser = useAuthStore((s) => s.setUser);
  const router = useRouter();
  const cleanupRef = useRef<(() => void) | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  async function handleDesktopOAuth() {
    setLoading(true);
    try {
      const { start, cancel, onUrl, onInvalidUrl } =
        await import("@fabianlars/tauri-plugin-oauth");
      const { openUrl } = await import("@tauri-apps/plugin-opener");

      // Start localhost callback server with custom success page
      const port = await start({ response: OAUTH_SUCCESS_HTML });
      let completed = false;

      const stopServer = () => {
        if (!completed) {
          completed = true;
          cancel(port).catch(() => {});
          setLoading(false);
        }
      };

      // Store cleanup for unmount
      cleanupRef.current = stopServer;

      // Timeout: cancel if user doesn't complete auth
      const timeout = setTimeout(stopServer, OAUTH_TIMEOUT_MS);

      // Handle OAuth errors
      await onInvalidUrl(() => {
        clearTimeout(timeout);
        stopServer();
      });

      // Listen for the OAuth callback URL
      await onUrl((callbackUrl: string) => {
        clearTimeout(timeout);
        try {
          const params = new URL(callbackUrl).searchParams;
          const accessToken = params.get("access_token");
          const refreshToken = params.get("refresh_token");
          const userParam = params.get("user");
          const redirect = params.get("redirect") || "/workspaces";

          // Store tokens for bearer auth strategy
          if (accessToken) localStorage.setItem("access_token", accessToken);
          if (refreshToken) localStorage.setItem("refresh_token", refreshToken);

          // Set user in Zustand store
          if (userParam) {
            const user = JSON.parse(decodeURIComponent(userParam));
            setUser(user);
            setLoggedInFlag();
          }

          router.replace(redirect);
        } catch (err) {
          console.error("Failed to handle OAuth callback:", err);
        } finally {
          stopServer();
          cleanupRef.current = null;
        }
      });

      // Open system browser for Google OAuth
      const redirectUri = encodeURIComponent(`http://localhost:${port}`);
      await openUrl(
        `${API_URL}/auth/google?redirect_uri=${redirectUri}&client_type=desktop`,
      );
    } catch (err) {
      console.error("Desktop OAuth failed:", err);
      setLoading(false);
    }
  }

  function handleWebOAuth() {
    const redirectUri = encodeURIComponent(window.location.href);
    window.location.href = `${API_URL}/auth/google?redirect_uri=${redirectUri}`;
  }

  return (
    <button
      type="button"
      onClick={checkIsDesktop() ? handleDesktopOAuth : handleWebOAuth}
      disabled={loading}
      className="flex w-full items-center justify-center gap-3 rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
          fill="#4285F4"
        />
        <path
          d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
          fill="#34A853"
        />
        <path
          d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
          fill="#FBBC05"
        />
        <path
          d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
          fill="#EA4335"
        />
      </svg>
      {loading ? "Opening browser..." : "Continue with Google"}
    </button>
  );
}
