import { Module } from "@nestjs/common";
import { CalendarController } from "./calendar.controller";
import { CalendarService } from "./calendar.service";
import { TodoModule } from "../todo/todo.module";
import { JournalModule } from "../journal/journal.module";
import { HabitEntryModule } from "../habit-entry/habit-entry.module";
import { HabitModule } from "../habit/habit.module";

@Module({
  imports: [TodoModule, JournalModule, HabitEntryModule, HabitModule],
  controllers: [CalendarController],
  providers: [CalendarService],
})
export class CalendarModule {}
