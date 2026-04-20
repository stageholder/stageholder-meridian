import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { JournalSecurityController } from "./journal-security.controller";
import { JournalSecurityService } from "./journal-security.service";
import {
  JournalSecurity,
  JournalSecuritySchema,
} from "./journal-security.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: JournalSecurity.name, schema: JournalSecuritySchema },
    ]),
  ],
  controllers: [JournalSecurityController],
  providers: [JournalSecurityService],
  exports: [JournalSecurityService],
})
export class JournalSecurityModule {}
