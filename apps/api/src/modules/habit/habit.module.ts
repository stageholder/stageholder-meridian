import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { HabitModel, HabitSchema } from "./habit.schema";
import { HabitRepository } from "./habit.repository";
import { HabitService } from "./habit.service";
import { HabitController } from "./habit.controller";
import { WorkspaceMemberModule } from "../workspace-member/workspace-member.module";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: HabitModel.name, schema: HabitSchema }]),
    WorkspaceMemberModule,
  ],
  controllers: [HabitController],
  providers: [HabitRepository, HabitService],
  exports: [HabitService, HabitRepository],
})
export class HabitModule {}
