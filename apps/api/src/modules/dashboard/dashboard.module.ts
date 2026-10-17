import { Module } from "@nestjs/common";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { HabitModule } from "../habit/habit.module";
import { HabitEntryModule } from "../habit-entry/habit-entry.module";
import { TodoModule } from "../todo/todo.module";
import { JournalModule } from "../journal/journal.module";
import { LightModule } from "../light/light.module";

@Module({
  imports: [
    HabitModule,
    HabitEntryModule,
    TodoModule,
    JournalModule,
    LightModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
