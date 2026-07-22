import { Controller, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import {
  Public,
  StageholderWebhookGuard,
  WebhookDispatcher,
} from "@stageholder/sdk/nestjs";
import type { StageholderWebhookEvent } from "@stageholder/sdk/core";

interface AuthenticatedWebhookRequest {
  /** Attached by `StageholderWebhookGuard` after signature verification. */
  event?: StageholderWebhookEvent;
}

/**
 * Receives outbound webhooks from the Stageholder Hub.
 *
 * Thin by design — it owns ONLY the transport/auth boundary and delegates all
 * routing to the SDK's `WebhookDispatcher`:
 *
 * 1. `@Public()` skips Meridian's global bearer-token guard (the endpoint has
 *    its own auth — the HMAC signature in the request). Required because
 *    `StageholderAuthGuard` is registered as `APP_GUARD`; the SDK's built-in
 *    webhook controller has no `@Public()`, which is why we keep this one.
 * 2. `StageholderWebhookGuard` verifies the `svix-id` / `svix-timestamp` /
 *    `svix-signature` headers against `STAGEHOLDER_WEBHOOK_SECRET` (→ 401 on
 *    bad signature, 400 on stale timestamp via `StageholderWebhookExceptionFilter`
 *    registered globally in main.ts) and attaches the typed event to `req.event`.
 * 3. `dispatchAndRecord` dedupes by event id (durable Mongo store), routes to
 *    `@StageholderWebhookHandler`-decorated providers, and records the delivery
 *    for the operator console. On a failed handler it returns `status: "failed"`
 *    (already recorded) and we rethrow so Nest returns non-2xx → Svix redelivers.
 *
 * The route path is unchanged from the previous hand-rolled receiver
 * (`/api/v1/webhooks/stageholder`), so Hub's registered endpoint keeps working.
 */
@Controller("webhooks/stageholder")
export class HubWebhookController {
  constructor(private readonly dispatcher: WebhookDispatcher) {}

  @Public()
  @UseGuards(StageholderWebhookGuard)
  @Post()
  @HttpCode(200)
  async handle(@Req() req: AuthenticatedWebhookRequest): Promise<{ ok: true }> {
    if (!req.event) {
      // Defense-in-depth: unreachable if the guard ran, but fail loudly rather
      // than silently acknowledge if `@UseGuards` is ever removed by accident.
      throw new Error("StageholderWebhookGuard did not attach req.event");
    }
    const outcome = await this.dispatcher.dispatchAndRecord(req.event, "push");
    if (outcome.status === "failed") {
      throw new Error(
        `Webhook handler failed: ${outcome.error ?? "unknown error"}`,
      );
    }
    return { ok: true };
  }
}
