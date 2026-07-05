import { Module, forwardRef } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { HabitGroupModel, HabitGroupSchema } from "./habit-group.schema";
import { HabitGroupRepository } from "./habit-group.repository";
import { HabitGroupService } from "./habit-group.service";
import { HabitGroupController } from "./habit-group.controller";
import { HabitModule } from "../habit/habit.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HabitGroupModel.name, schema: HabitGroupSchema },
    ]),
    // forwardRef: HabitModule imports this module back (HabitService → group
    // ownership validation), forming an intentional cycle.
    forwardRef(() => HabitModule),
  ],
  controllers: [HabitGroupController],
  providers: [HabitGroupRepository, HabitGroupService],
  // Export the repository so HabitService can validate a habit's target group.
  exports: [HabitGroupService, HabitGroupRepository],
})
export class HabitGroupModule {}
