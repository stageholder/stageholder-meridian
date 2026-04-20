import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { HabitEntryModel, HabitEntrySchema } from "./habit-entry.schema";
import { HabitEntryRepository } from "./habit-entry.repository";
import { HabitEntryService } from "./habit-entry.service";
import {
  HabitEntryController,
  HabitEntrySyncController,
} from "./habit-entry.controller";
import { LightModule } from "../light/light.module";
import { HabitModule } from "../habit/habit.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HabitEntryModel.name, schema: HabitEntrySchema },
    ]),
    LightModule,
    HabitModule,
  ],
  controllers: [HabitEntrySyncController, HabitEntryController],
  providers: [HabitEntryRepository, HabitEntryService],
  exports: [HabitEntryService, HabitEntryRepository],
})
export class HabitEntryModule {}
