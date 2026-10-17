import { Module, forwardRef } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { UserLightModel, UserLightSchema } from "./user-light.schema";
import { LightEventModel, LightEventSchema } from "./light-event.schema";
import { UserLightRepository } from "./repository/user-light.repository";
import { LightEventRepository } from "./repository/light-event.repository";
import { LightService } from "./light.service";
import { LightController } from "./light.controller";
import { HabitModule } from "../habit/habit.module";
import {
  HabitEntryModel,
  HabitEntrySchema,
} from "../habit-entry/habit-entry.schema";
import { NotificationModule } from "../notification/notification.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserLightModel.name, schema: UserLightSchema },
      { name: LightEventModel.name, schema: LightEventSchema },
      { name: HabitEntryModel.name, schema: HabitEntrySchema },
    ]),
    // Deferred for the same reason as habit-entry.module.ts: this module sits
    // on the Light → Habit → HabitEntry → Light cycle, so the reference must
    // not be read during module evaluation.
    forwardRef(() => HabitModule),
    NotificationModule,
  ],
  controllers: [LightController],
  providers: [UserLightRepository, LightEventRepository, LightService],
  exports: [LightService],
})
export class LightModule {}
