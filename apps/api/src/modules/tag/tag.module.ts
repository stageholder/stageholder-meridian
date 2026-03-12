import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { TagModel, TagSchema } from "./tag.schema";
import { TagRepository } from "./tag.repository";
import { TagService } from "./tag.service";
import { TagController } from "./tag.controller";
import { WorkspaceMemberModule } from "../workspace-member/workspace-member.module";

@Module({
  imports: [
    MongooseModule.forFeature([{ name: TagModel.name, schema: TagSchema }]),
    WorkspaceMemberModule,
  ],
  controllers: [TagController],
  providers: [TagRepository, TagService],
  exports: [TagService],
})
export class TagModule {}
