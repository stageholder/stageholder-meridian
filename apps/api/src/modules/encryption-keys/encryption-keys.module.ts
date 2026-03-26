import { Module } from "@nestjs/common";
import { UserModule } from "../user/user.module";
import { EncryptionKeysController } from "./encryption-keys.controller";
import { EncryptionKeysService } from "./encryption-keys.service";

@Module({
  imports: [UserModule],
  controllers: [EncryptionKeysController],
  providers: [EncryptionKeysService],
})
export class EncryptionKeysModule {}
