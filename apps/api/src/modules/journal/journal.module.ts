import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { JournalModel, JournalSchema } from "./journal.schema";
import { JournalRepository } from "./journal.repository";
import { JournalService } from "./journal.service";
import { JournalController } from "./journal.controller";
import { LightModule } from "../light/light.module";
import { EncryptionModule } from "../encryption";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: JournalModel.name, schema: JournalSchema },
    ]),
    LightModule,
    EncryptionModule,
  ],
  controllers: [JournalController],
  providers: [JournalRepository, JournalService],
  exports: [JournalService, JournalRepository],
})
export class JournalModule {}
