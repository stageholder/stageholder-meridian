import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  HubEventFailed,
  HubEventFailedDocument,
  HubEventsCursor,
  HubEventsCursorDocument,
} from "./hub-events.schema";
import { JournalService } from "../journal/journal.service";
import { HabitService } from "../habit/habit.service";
import { HabitEntryService } from "../habit-entry/habit-entry.service";
import { TodoListService } from "../todo-list/todo-list.service";
import { TodoService } from "../todo/todo.service";
import { TagService } from "../tag/tag.service";
import { NotificationService } from "../notification/notification.service";
import { JournalSecurityService } from "../journal-security/journal-security.service";
import { LightService } from "../light/light.service";
import { ActivityService } from "../activity/activity.service";
import { FeedbackService } from "../feedback/feedback.service";
import { UserService } from "../user/user.service";

interface HubEvent {
  id: string;
  type: string;
  product: string | null;
  userSub: string | null;
  orgId: string | null;
  payload: Record<string, unknown> | null;
  occurredAt: string;
}

interface PollResponse {
  events: HubEvent[];
  nextCursor: string | null;
}

const CURSOR_KEY = "meridian";
const POLL_BATCH = 100;
const POLL_TIMEOUT_MS = 10_000;

// Polls Hub's /api/events endpoint for events targeted at Meridian and
// reacts to them. The only event we currently care about is `user.deleted`
// (account deletion at the Hub, which means we must purge this user's data
// locally). Subscription/entitlement changes are handled via live token
// claims on each request so they don't need a local reaction.
//
// Auth: Basic auth with the Meridian OIDC client_id / client_secret, which
// Hub verifies against `oidc_clients`. The cron runs every 5 minutes; if
// Hub is down we just log and retry on the next tick.
@Injectable()
export class HubEventsService {
  private readonly logger = new Logger(HubEventsService.name);
  private lastPollFailure: string | null = null;

  constructor(
    @InjectModel(HubEventsCursor.name)
    private readonly cursorModel: Model<HubEventsCursorDocument>,
    @InjectModel(HubEventFailed.name)
    private readonly failedModel: Model<HubEventFailedDocument>,
    private readonly config: ConfigService,
    private readonly journalService: JournalService,
    private readonly habitService: HabitService,
    private readonly habitEntryService: HabitEntryService,
    private readonly todoListService: TodoListService,
    private readonly todoService: TodoService,
    private readonly tagService: TagService,
    private readonly notificationService: NotificationService,
    private readonly journalSecurityService: JournalSecurityService,
    private readonly lightService: LightService,
    private readonly activityService: ActivityService,
    private readonly feedbackService: FeedbackService,
    private readonly userService: UserService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES, { name: "pollHubEvents" })
  async poll(): Promise<void> {
    // Hub's /api/events endpoint lives at the hub origin, NOT under the
    // OIDC subpath. Prefer IDENTITY_HUB_URL; fall back to stripping the
    // path off IDENTITY_ISSUER_URL so older env files still work.
    const issuer = this.config.get<string>("IDENTITY_ISSUER_URL");
    const hubUrl =
      this.config.get<string>("IDENTITY_HUB_URL") ??
      (issuer ? new URL(issuer).origin : undefined);
    const clientId = this.config.get<string>("IDENTITY_CLIENT_ID");
    const clientSecret = this.config.get<string>("IDENTITY_CLIENT_SECRET");
    if (!hubUrl || !clientId || !clientSecret) {
      this.logger.warn("Hub credentials missing; skipping event poll");
      return;
    }

    const row = await this.cursorModel.findById(CURSOR_KEY).lean();
    const since = row?.cursor ?? undefined;

    const url = new URL(`${hubUrl}/api/events`);
    url.searchParams.set("product", "meridian");
    if (since) url.searchParams.set("since", since);
    url.searchParams.set("limit", String(POLL_BATCH));

    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    let res: Response;
    try {
      res = await fetch(url.toString(), {
        headers: { Authorization: `Basic ${basic}` },
        signal: AbortSignal.timeout(POLL_TIMEOUT_MS),
      });
    } catch (err) {
      this.reportFailure(`network:${(err as Error).message}`);
      return;
    }
    if (!res.ok) {
      this.reportFailure(`http:${res.status}`);
      return;
    }

    if (this.lastPollFailure !== null) {
      this.logger.log("Hub events poll recovered");
      this.lastPollFailure = null;
    }

    const body = (await res.json()) as PollResponse;

    for (const ev of body.events) {
      try {
        await this.handle(ev);
      } catch (err) {
        // Record the failure in the dead-letter collection and continue
        // processing. Advancing the cursor past a failed event is necessary
        // to avoid head-of-line blocking (a single broken event would halt
        // every subsequent user's cascade) but we MUST leave a trace — a
        // dropped `user.deleted` is a GDPR-grade compliance issue. Operator
        // inspects `hub_events_failed` and retries manually.
        const error = (err as Error).message;
        this.logger.error(
          `Failed to handle event ${ev.id} (${ev.type}): ${error}`,
        );
        await this.failedModel
          .findByIdAndUpdate(
            ev.id,
            {
              _id: ev.id,
              type: ev.type,
              userSub: ev.userSub,
              occurredAt: ev.occurredAt,
              $inc: { attempts: 1 },
              lastError: error,
            },
            { upsert: true, new: true },
          )
          .catch((persistErr) => {
            // If even the DLQ write fails (Mongo unreachable?), log loudly.
            this.logger.error(
              `Failed to record DLQ entry for event ${ev.id}: ${(persistErr as Error).message}`,
            );
          });
      }
    }

    if (body.nextCursor) {
      await this.cursorModel.findByIdAndUpdate(
        CURSOR_KEY,
        { cursor: body.nextCursor },
        { upsert: true, new: true },
      );
    }
  }

  // Log each distinct failure mode once; repeated identical failures stay
  // silent until the next state change (success or a different error). Keeps
  // the log clean when the Hub is briefly down without hiding new symptoms.
  private reportFailure(kind: string): void {
    if (this.lastPollFailure === kind) return;
    this.logger.warn(`Hub events poll failed: ${kind}`);
    this.lastPollFailure = kind;
  }

  /**
   * Retry a single previously-failed event. Called from an admin tool or
   * script; not exposed via HTTP. On success the DLQ entry is removed.
   */
  async retryFailed(eventId: string): Promise<boolean> {
    const row = await this.failedModel.findById(eventId).lean();
    if (!row) return false;
    try {
      await this.handle({
        id: row._id,
        type: row.type,
        product: "meridian",
        userSub: row.userSub,
        orgId: null,
        payload: null,
        occurredAt: row.occurredAt,
      });
      await this.failedModel.deleteOne({ _id: eventId });
      return true;
    } catch (err) {
      await this.failedModel.updateOne(
        { _id: eventId },
        { $inc: { attempts: 1 }, lastError: (err as Error).message },
      );
      return false;
    }
  }

  private async handle(ev: HubEvent): Promise<void> {
    if (ev.type === "user.deleted" && ev.userSub) {
      await this.cascadeDeleteUser(ev.userSub);
    }
    // Other event types (e.g. subscription.updated) are intentional no-ops:
    // entitlement claims are resolved from the live access token on every
    // write, so there's nothing cached locally to invalidate.
  }

  private async cascadeDeleteUser(userSub: string): Promise<void> {
    this.logger.log(`Cascade-deleting Meridian data for sub=${userSub}`);
    await Promise.all([
      this.journalService.deleteAllForUser(userSub),
      this.habitService.deleteAllForUser(userSub),
      this.habitEntryService.deleteAllForUser(userSub),
      this.todoService.deleteAllForUser(userSub),
      this.todoListService.deleteAllForUser(userSub),
      this.tagService.deleteAllForUser(userSub),
      this.notificationService.deleteAllForUser(userSub),
      this.journalSecurityService.deleteForUser(userSub),
      this.lightService.deleteAllForUser(userSub),
      this.activityService.deleteAllForUser(userSub),
      this.feedbackService.deleteAllForUser(userSub),
      this.userService.deleteAllForUser(userSub),
    ]);
    this.logger.log(`Cascade delete complete for sub=${userSub}`);
  }
}
