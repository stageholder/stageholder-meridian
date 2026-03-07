import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JournalModel, JournalSchema } from './journal.schema';
import { JournalRepository } from './journal.repository';
import { JournalService } from './journal.service';
import { JournalController } from './journal.controller';
import { WorkspaceMemberModule } from '../workspace-member/workspace-member.module';
import { LightModule } from '../light/light.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: JournalModel.name, schema: JournalSchema }]),
    WorkspaceMemberModule,
    LightModule,
  ],
  controllers: [JournalController],
  providers: [JournalRepository, JournalService],
  exports: [JournalService, JournalRepository],
})
export class JournalModule {}
