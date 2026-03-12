import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ActivityModel, ActivitySchema } from "./activity.schema";
import { ActivityRepository } from "./activity.repository";
import { ActivityService } from "./activity.service";
import { ActivityController } from "./activity.controller";
import { WorkspaceMemberModule } from "../workspace-member/workspace-member.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ActivityModel.name, schema: ActivitySchema },
    ]),
    WorkspaceMemberModule,
  ],
  controllers: [ActivityController],
  providers: [ActivityRepository, ActivityService],
  exports: [ActivityService],
})
export class ActivityModule {}
