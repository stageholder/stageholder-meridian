import { type Page } from "@playwright/test";

import { env } from "./env";

/**
 * Sign in through the Stageholder Hub login page. An anonymous visit to the
 * PWA goes `/auth/login` → SDK `signIn()` → Hub authorize → Hub web login
 * (:4829). After submit the Hub redirects back to `/auth/callback?code=`, the
 * SDK finishes PKCE and the app lands on `startPath` (or `/onboarding` for a
 * new account).
 *
 * Credentials are typed straight into the form; they are never logged.
 */
export async function signInViaHub(
  page: Page,
  email: string,
  password: string,
  startPath = "/",
): Promise<void> {
  await page.goto(startPath);
  const emailBox = page.getByRole("textbox", { name: /email/i });
  await emailBox.waitFor({ state: "visible", timeout: 45_000 });
  // The Hub form hydrates after first paint; typing before that is lost.
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await emailBox.fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await waitForAppUrl(page);
}

/**
 * The Hub → /auth/callback → app redirect chain can abort an intermediate
 * navigation (net::ERR_ABORTED); wait on URL commits until the app URL is
 * reached. The Hub may show an OIDC consent screen on a first sign-in; accept
 * it when it appears.
 */
export async function waitForAppUrl(page: Page): Promise<void> {
  const app = new URL(env.pwaUrl).origin;
  const landed = (url: URL) =>
    url.origin === app && !url.pathname.startsWith("/auth/");
  const deadline = Date.now() + 60_000;
  for (;;) {
    try {
      await page.waitForURL(landed, {
        timeout: Math.min(10_000, Math.max(1_000, deadline - Date.now())),
        waitUntil: "commit",
      });
      break;
    } catch (error) {
      if (Date.now() >= deadline) throw error;
      const consent = page.getByRole("button", {
        name: /^(allow|authorize|continue|accept)$/i,
      });
      if (
        await consent
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        await consent.first().click();
      }
    }
  }
  await page.waitForLoadState("domcontentloaded").catch(() => undefined);
}
