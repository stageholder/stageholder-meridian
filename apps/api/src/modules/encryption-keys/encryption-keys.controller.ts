import { Controller, Get, Post, Body } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { EncryptionKeysService } from "./encryption-keys.service";
import {
  SetupEncryptionDto,
  ChangePassphraseDto,
  VerifyRecoveryDto,
  SetupEncryptionDto as SetupSchema,
  ChangePassphraseDto as ChangeSchema,
  VerifyRecoveryDto as VerifySchema,
} from "./encryption-keys.dto";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { CurrentUserId } from "../../common/decorators/current-user.decorator";

@ApiTags("Encryption Keys")
@Controller("encryption-keys")
export class EncryptionKeysController {
  constructor(private readonly service: EncryptionKeysService) {}

  @Post("setup")
  async setup(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(SetupSchema)) dto: SetupEncryptionDto,
  ) {
    await this.service.setup(userId, dto);
    return { success: true };
  }

  @Get()
  async getKeys(@CurrentUserId() userId: string) {
    return this.service.getKeys(userId);
  }

  @Post("change-passphrase")
  async changePassphrase(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(ChangeSchema)) dto: ChangePassphraseDto,
  ) {
    await this.service.changePassphrase(userId, dto);
    return { success: true };
  }

  @Post("verify-recovery")
  async verifyRecovery(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(VerifySchema)) dto: VerifyRecoveryDto,
  ) {
    return this.service.verifyRecovery(userId, dto.code);
  }
}
