import { Module } from "@nestjs/common";
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
    HabitModule,
  ],
  controllers: [HabitGroupController],
  providers: [HabitGroupRepository, HabitGroupService],
  exports: [HabitGroupService],
})
export class HabitGroupModule {}
