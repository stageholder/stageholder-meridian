import { Module } from "@nestjs/common";
import { HubWebhookController } from "./hub-webhook.controller";
import { HubWebhookHandlers } from "./hub-webhook.handlers";
import { JournalModule } from "../journal/journal.module";
import { HabitModule } from "../habit/habit.module";
import { HabitEntryModule } from "../habit-entry/habit-entry.module";
import { TodoListModule } from "../todo-list/todo-list.module";
import { TodoModule } from "../todo/todo.module";
import { TagModule } from "../tag/tag.module";
import { NotificationModule } from "../notification/notification.module";
import { JournalSecurityModule } from "../journal-security/journal-security.module";
import { LightModule } from "../light/light.module";
import { ActivityModule } from "../activity/activity.module";
import { FeedbackModule } from "../feedback/feedback.module";
import { UserModule } from "../user/user.module";

/**
 * Stageholder webhook receiver for Meridian.
 *
 * Hub pushes events via Svix to {@link HubWebhookController}'s POST endpoint.
 * Everything below the transport boundary is the SDK's webhook stack:
 * `StageholderWebhookGuard` verifies signatures, `WebhookDispatcher` routes to
 * `@StageholderWebhookHandler`-decorated methods on {@link HubWebhookHandlers},
 * dedupes by event id, and records deliveries. The dispatcher, guard, dedupe
 * store, and delivery store are all provided by
 * `StageholderWebhookModule.forRootAsync` in app.module.ts (global).
 *
 * This module just contributes the receiver controller, the handler provider,
 * and the data-service modules the cascade-delete fan-out needs. Adding a new
 * event handler that needs another service? Import its module here.
 */
@Module({
  imports: [
    JournalModule,
    HabitModule,
    HabitEntryModule,
    TodoListModule,
    TodoModule,
    TagModule,
    NotificationModule,
    JournalSecurityModule,
    LightModule,
    ActivityModule,
    FeedbackModule,
    UserModule,
  ],
  controllers: [HubWebhookController],
  providers: [HubWebhookHandlers],
})
export class HubWebhookModule {}
