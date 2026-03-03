import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkspaceModel, WorkspaceSchema } from './workspace.schema';
import { WorkspaceRepository } from './workspace.repository';
import { WorkspaceService } from './workspace.service';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceMemberModule } from '../workspace-member/workspace-member.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: WorkspaceModel.name, schema: WorkspaceSchema }]),
    forwardRef(() => WorkspaceMemberModule),
  ],
  controllers: [WorkspaceController],
  providers: [WorkspaceRepository, WorkspaceService],
  exports: [WorkspaceService],
})
export class WorkspaceModule {}
