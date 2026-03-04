import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HabitEntryModel, HabitEntrySchema } from './habit-entry.schema';
import { HabitEntryRepository } from './habit-entry.repository';
import { HabitEntryService } from './habit-entry.service';
import { HabitEntryController } from './habit-entry.controller';
import { WorkspaceMemberModule } from '../workspace-member/workspace-member.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: HabitEntryModel.name, schema: HabitEntrySchema }]),
    WorkspaceMemberModule,
  ],
  controllers: [HabitEntryController],
  providers: [HabitEntryRepository, HabitEntryService],
  exports: [HabitEntryService, HabitEntryRepository],
})
export class HabitEntryModule {}
