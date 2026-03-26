import { Controller, Post, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { JournalModel, JournalDocument } from "./journal.schema";
import { EncryptionService } from "../encryption";
import { CurrentUserId } from "../../common/decorators/current-user.decorator";
import { WorkspaceMemberService } from "../workspace-member/workspace-member.service";

/**
 * Temporary migration endpoint.
 * Decrypts server-side encrypted journals and returns plaintext
 * so the client can re-encrypt with the user's E2E key.
 * Remove this controller after all users have migrated.
 */
@ApiTags("Journal Migration")
@Controller("workspaces/:workspaceId/journals")
export class JournalMigrationController {
  constructor(
    @InjectModel(JournalModel.name)
    private readonly model: Model<JournalDocument>,
    private readonly encryption: EncryptionService,
    private readonly memberService: WorkspaceMemberService,
  ) {}

  @Post("migrate-encryption")
  async migrateEncryption(
    @Param("workspaceId") workspaceId: string,
    @CurrentUserId() userId: string,
  ) {
    await this.memberService.requireRole(workspaceId, userId, [
      "owner",
      "admin",
      "member",
    ]);

    // Find journals that are server-side encrypted (not yet E2E)
    const docs = await this.model
      .find({
        workspace_id: workspaceId,
        author_id: userId,
        deleted_at: null,
        $or: [{ encrypted: { $ne: true } }, { encrypted: { $exists: false } }],
      })
      .lean();

    const decrypted = docs.map((doc: any) => ({
      id: doc._id,
      title: this.encryption.decrypt(doc.title) ?? doc.title,
      content: this.encryption.decrypt(doc.content) ?? doc.content,
      tags: Array.isArray(doc.tags)
        ? doc.tags.map((t: string) => this.encryption.decrypt(t) ?? t)
        : doc.tags,
      mood: doc.mood,
      date: doc.date,
      wordCount: doc.word_count ?? 0,
    }));

    return { journals: decrypted, count: decrypted.length };
  }
}
