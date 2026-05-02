import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import type { StageholderWebhookEvent } from "@stageholder/sdk/core";
import {
  HubWebhookFailed,
  HubWebhookFailedDocument,
} from "./hub-webhook.schema";
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

/**
 * Reacts to Hub-emitted webhook events. The signature/replay verification
 * is done upstream by `StageholderWebhookGuard`; this service only sees
 * events that already passed verification.
 *
 * Meridian is a personal-only product — its data is keyed by `(userSub,
 * orgId)` and never shared between users. This means:
 *
 * - **`user.deleted`**: hard requirement (GDPR). Cascade-delete every row
 *   keyed by the user's sub.
 * - **subscription / product_access / org events**: no-op locally because
 *   entitlement claims are resolved from the live access token on every
 *   write. Nothing to invalidate.
 * - **`org.updated` (slug rename or kind transition)**: no-op. Meridian
 *   keys data by orgId UUID, not slug. Kind transitions (personal→team)
 *   are handled by the kind-agnostic posture documented in CLAUDE.md.
 *
 * Adding a new handler? Add a case in {@link handle} and add the data
 * service to the constructor + module imports.
 */
@Injectable()
export class HubWebhookService {
  private readonly logger = new Logger(HubWebhookService.name);

  constructor(
    @InjectModel(HubWebhookFailed.name)
    private readonly failedModel: Model<HubWebhookFailedDocument>,
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

  /**
   * Dispatch a verified webhook event. Throws on handler failure so the
   * controller can return 500 — Hub then retries via the Svix backoff
   * schedule. We also persist a row in the local DLQ so operators have a
   * queryable trace independent of Hub's admin UI.
   */
  async handle(event: StageholderWebhookEvent): Promise<void> {
    try {
      switch (event.type) {
        case "user.deleted":
          await this.cascadeDeleteUser(event.data.userId);
          return;

        // Live token claims cover entitlement on every write — nothing to
        // invalidate locally. Keep these as explicit no-ops so the
        // exhaustive switch reads cleanly and we don't accidentally treat
        // them as "unknown" failures.
        case "subscription.activated":
        case "subscription.updated":
        case "subscription.canceled":
        case "subscription.trial_ending":
        case "subscription.payment_failed":
        case "product_access.granted":
        case "product_access.revoked":
        case "product_access.role_changed":
        case "org.member.added":
        case "org.member.removed":
        case "org.member.role_changed":
        case "org.updated":
        case "org.deleted":
        case "user.profile_updated":
          return;
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to handle webhook ${event.id} (${event.type}): ${error}`,
      );
      await this.recordFailure(event, error);
      throw err;
    }
  }

  /**
   * Hard-delete every Meridian artifact for a user. Triggered on
   * `user.deleted` from Hub (account deletion at Identity).
   *
   * Runs all per-collection deletes concurrently — they're independent and
   * any one failing should not block the others (each service handles its
   * own errors internally; we surface them via the outer try/catch in
   * {@link handle}).
   */
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

  private async recordFailure(
    event: StageholderWebhookEvent,
    error: string,
  ): Promise<void> {
    try {
      await this.failedModel.findByIdAndUpdate(
        event.id,
        {
          _id: event.id,
          type: event.type,
          userSub:
            "userId" in event.data ? (event.data.userId as string) : null,
          occurredAt: event.timestamp,
          $inc: { attempts: 1 },
          lastError: error,
          payload: event.data as Record<string, unknown>,
        },
        { upsert: true, new: true },
      );
    } catch (persistErr) {
      // If even the DLQ write fails (Mongo unreachable?), log loudly.
      // Hub's own retry will still drive eventual consistency.
      this.logger.error(
        `Failed to record DLQ entry for event ${event.id}: ${
          (persistErr as Error).message
        }`,
      );
    }
  }

  /**
   * Replay a previously-failed event from the local DLQ. Called from an
   * admin tool / operator script; not exposed via HTTP. On success the
   * row is removed.
   */
  async retryFailed(eventId: string): Promise<boolean> {
    const row = await this.failedModel.findById(eventId).lean();
    if (!row || !row.payload) return false;
    try {
      await this.handle({
        id: row._id,
        type: row.type as StageholderWebhookEvent["type"],
        timestamp: row.occurredAt,
        data: row.payload,
      } as StageholderWebhookEvent);
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
}
