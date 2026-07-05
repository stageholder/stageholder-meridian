import { Module, forwardRef } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { HabitModel, HabitSchema } from "./habit.schema";
import { HabitRepository } from "./habit.repository";
import { HabitService } from "./habit.service";
import { HabitController } from "./habit.controller";
import { HabitGroupModule } from "../habit-group/habit-group.module";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: HabitModel.name, schema: HabitSchema }]),
    // Bidirectional: HabitService validates a habit's target group via
    // HabitGroupRepository; HabitGroupModule imports HabitModule for its
    // orphan-on-delete cascade.
    forwardRef(() => HabitGroupModule),
  ],
  controllers: [HabitController],
  providers: [HabitRepository, HabitService],
  exports: [HabitService, HabitRepository],
})
export class HabitModule {}
