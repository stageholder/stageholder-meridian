import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkspaceMemberModel, WorkspaceMemberSchema } from './workspace-member.schema';
import { WorkspaceMemberRepository } from './workspace-member.repository';
import { WorkspaceMemberService } from './workspace-member.service';
import { WorkspaceMemberController } from './workspace-member.controller';
import { InvitationController } from './invitation.controller';
import { UserModule } from '../user/user.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: WorkspaceMemberModel.name, schema: WorkspaceMemberSchema }]),
    UserModule,
    forwardRef(() => WorkspaceModule),
    NotificationModule,
  ],
  controllers: [WorkspaceMemberController, InvitationController],
  providers: [WorkspaceMemberRepository, WorkspaceMemberService],
  exports: [WorkspaceMemberService],
})
export class WorkspaceMemberModule {}
