import { Controller, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import { StageholderWebhookGuard } from "@stageholder/sdk/nestjs";
import type { StageholderWebhookEvent } from "@stageholder/sdk/core";
import { Public } from "@stageholder/sdk/nestjs";
import { HubWebhookService } from "./hub-webhook.service";

interface AuthenticatedWebhookRequest {
  /** Attached by `StageholderWebhookGuard` after signature verification. */
  event?: StageholderWebhookEvent;
}

/**
 * Receives outbound webhooks from the Stageholder Hub.
 *
 * Auth flow:
 * 1. `@Public()` skips Meridian's bearer-token guard (this endpoint has its
 *    own auth — the HMAC signature in the request).
 * 2. `StageholderWebhookGuard` verifies the `svix-id` / `svix-timestamp` /
 *    `svix-signature` headers against `STAGEHOLDER_WEBHOOK_SECRET` and
 *    rejects on bad signature (→ 401) or stale timestamp (→ 400) via
 *    `StageholderWebhookExceptionFilter` registered globally in main.ts.
 * 3. On success the parsed, typed event is on `req.event`.
 *
 * On handler failure we re-throw so Nest returns 500 — Hub's Svix retry
 * queue will redeliver. The local `hub_webhook_failed` collection records
 * a row for operators independently of Hub's DLQ.
 */
@Controller("webhooks/stageholder")
export class HubWebhookController {
  constructor(private readonly service: HubWebhookService) {}

  @Public()
  @UseGuards(StageholderWebhookGuard)
  @Post()
  @HttpCode(200)
  async handle(@Req() req: AuthenticatedWebhookRequest): Promise<{ ok: true }> {
    if (!req.event) {
      // Defense-in-depth: should never happen if the guard ran, but if
      // someone removes @UseGuards by accident we want to fail loudly
      // rather than silently treat the request as a no-op.
      throw new Error("StageholderWebhookGuard did not attach req.event");
    }
    await this.service.handle(req.event);
    return { ok: true };
  }
}
