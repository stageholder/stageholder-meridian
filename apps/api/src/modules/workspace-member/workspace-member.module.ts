import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkspaceMemberModel, WorkspaceMemberSchema } from './workspace-member.schema';
import { WorkspaceMemberRepository } from './workspace-member.repository';
import { WorkspaceMemberService } from './workspace-member.service';
import { WorkspaceMemberController } from './workspace-member.controller';
import { UserModule } from '../user/user.module';
import { WorkspaceModule } from '../workspace/workspace.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: WorkspaceMemberModel.name, schema: WorkspaceMemberSchema }]),
    UserModule,
    forwardRef(() => WorkspaceModule),
  ],
  controllers: [WorkspaceMemberController],
  providers: [WorkspaceMemberRepository, WorkspaceMemberService],
  exports: [WorkspaceMemberService],
})
export class WorkspaceMemberModule {}
