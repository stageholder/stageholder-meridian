import { Module, forwardRef } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { HabitModel, HabitSchema } from "./habit.schema";
import { HabitRepository } from "./habit.repository";
import { HabitService } from "./habit.service";
import { HabitController } from "./habit.controller";
import { HabitGroupModule } from "../habit-group/habit-group.module";
import { HabitEntryModule } from "../habit-entry/habit-entry.module";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: HabitModel.name, schema: HabitSchema }]),
    // Bidirectional: HabitService validates a habit's target group via
    // HabitGroupRepository; HabitGroupModule imports HabitModule for its
    // orphan-on-delete cascade.
    forwardRef(() => HabitGroupModule),
    // Bidirectional: HabitEntryModule imports HabitModule for HabitRepository
    // (ownership checks); HabitService now needs HabitEntryService for the
    // `?withEntries` aggregation (Task 2.3).
    forwardRef(() => HabitEntryModule),
  ],
  controllers: [HabitController],
  providers: [HabitRepository, HabitService],
  exports: [HabitService, HabitRepository],
})
export class HabitModule {}
