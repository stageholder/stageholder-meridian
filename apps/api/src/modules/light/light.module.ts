import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserLightModel, UserLightSchema } from './user-light.schema';
import { LightEventModel, LightEventSchema } from './light-event.schema';
import { UserLightRepository } from './repository/user-light.repository';
import { LightEventRepository } from './repository/light-event.repository';
import { LightService } from './light.service';
import { LightController } from './light.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserLightModel.name, schema: UserLightSchema },
      { name: LightEventModel.name, schema: LightEventSchema },
    ]),
  ],
  controllers: [LightController],
  providers: [UserLightRepository, LightEventRepository, LightService],
  exports: [LightService],
})
export class LightModule {}
