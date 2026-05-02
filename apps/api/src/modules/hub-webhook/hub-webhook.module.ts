import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { HubWebhookService } from "./hub-webhook.service";
import { HubWebhookController } from "./hub-webhook.controller";
import { HubWebhookFailed, HubWebhookFailedSchema } from "./hub-webhook.schema";
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
 * Replaced the legacy `HubEventsModule` polling cron — Hub now pushes
 * events via Svix to {@link HubWebhookController}'s POST endpoint. The
 * `StageholderWebhookGuard` from the SDK verifies signatures; everything
 * downstream of the guard is plain Nest.
 *
 * Data services for the cascade-delete fan-out are imported here. When
 * adding a new event handler that needs another service, import its
 * module here so the DI graph stays explicit.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HubWebhookFailed.name, schema: HubWebhookFailedSchema },
    ]),
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
  providers: [HubWebhookService],
})
export class HubWebhookModule {}
