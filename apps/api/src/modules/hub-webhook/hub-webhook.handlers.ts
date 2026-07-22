import { Injectable, Logger } from "@nestjs/common";
import { StageholderWebhookHandler } from "@stageholder/sdk/nestjs";
import type { UserDeletedEvent } from "@stageholder/sdk/core";
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
 * Hub webhook handlers for Meridian, discovered automatically by the SDK's
 * `WebhookDispatcher` via `@StageholderWebhookHandler` — no controller
 * `switch(event.type)`, no manual routing, no hand-rolled dedupe/DLQ. The
 * dispatcher verifies (guard), dedupes (durable Mongo store), records the
 * delivery (operator console), and routes here.
 *
 * Meridian is a personal-only product keyed by `(userSub, orgId)` and never
 * shares data between users, so only ONE event is effectful:
 *
 * - **`user.deleted`** — GDPR hard requirement; cascade-delete every row keyed
 *   by the user's sub (below).
 *
 * Every other Hub event (`subscription.*`, `product_access.*`, `org.*`,
 * `user.profile_updated`) is intentionally left WITHOUT a handler: entitlement
 * is resolved from the live access token on every write, so there is nothing
 * to invalidate locally. The dispatcher logs those as unhandled no-ops and
 * marks them processed — the same behavior the old explicit no-op switch cases
 * provided, without the boilerplate.
 *
 * Adding a new effectful handler? Add a decorated method here and import its
 * data service into the constructor + `HubWebhookModule`.
 */
@Injectable()
export class HubWebhookHandlers {
  private readonly logger = new Logger(HubWebhookHandlers.name);

  constructor(
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
   * `user.deleted` → hard-delete every Meridian artifact for the user
   * (account deletion at Identity). A throw propagates out of the dispatcher
   * so the receiver returns non-2xx and Svix redelivers; the dispatcher only
   * marks the event processed once this resolves, so a redelivery re-runs it.
   *
   * Idempotent: deleting already-deleted rows is a no-op, so a redelivery (or
   * two concurrent deliveries) causes no harm.
   */
  @StageholderWebhookHandler("user.deleted")
  async onUserDeleted(event: UserDeletedEvent): Promise<void> {
    await this.cascadeDeleteUser(event.data.userId);
  }

  private async cascadeDeleteUser(userSub: string): Promise<void> {
    this.logger.log(`Cascade-deleting Meridian data for sub=${userSub}`);
    // Independent per-collection deletes run concurrently — any one failing
    // should not block the others; a rejection propagates to the dispatcher,
    // which returns non-2xx so Svix retries the whole cascade.
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
