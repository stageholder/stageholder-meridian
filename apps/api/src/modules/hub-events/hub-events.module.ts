import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { HubEventsService } from "./hub-events.service";
import {
  HubEventFailed,
  HubEventFailedSchema,
  HubEventsCursor,
  HubEventsCursorSchema,
} from "./hub-events.schema";
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

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HubEventsCursor.name, schema: HubEventsCursorSchema },
      { name: HubEventFailed.name, schema: HubEventFailedSchema },
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
  providers: [HubEventsService],
})
export class HubEventsModule {}
