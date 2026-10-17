import { Module, forwardRef } from "@nestjs/common";
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
    // forwardRef is required for MODULE EVALUATION order, not just Nest's DI
    // graph: HabitModule importing HabitEntryModule (below) closed a real
    // ESM cycle — Light → Habit → HabitEntry → Light. A bare `LightModule`
    // here is evaluated while light.module.ts is still mid-evaluation, so it
    // reads the class binding in its TDZ and the API dies at boot with
    // "Cannot access 'LightModule' before initialization". The thunk defers
    // the read until every module body has finished evaluating.
    forwardRef(() => LightModule),
    // Bidirectional: HabitModule now imports HabitEntryModule back (see
    // habit.module.ts) so HabitService can use HabitEntryService for the
    // `?withEntries` aggregation (Task 2.3).
    forwardRef(() => HabitModule),
  ],
  controllers: [HabitEntrySyncController, HabitEntryController],
  providers: [HabitEntryRepository, HabitEntryService],
  exports: [HabitEntryService, HabitEntryRepository],
})
export class HabitEntryModule {}
