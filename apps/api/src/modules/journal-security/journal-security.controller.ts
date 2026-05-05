import { Body, Controller, Get, Post, Put, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiTags } from "@nestjs/swagger";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { RequiresIntrospection } from "@stageholder/sdk/nestjs";
import type { StageholderRequest } from "../../common/types";
import { JournalSecurityService } from "./journal-security.service";
import {
  SetupEncryptionDto,
  ChangePassphraseDto,
  RecoverDto,
  FinalizeRecoveryDto,
} from "./journal-security.dto";

@ApiTags("Journal Security")
@Controller("journal-security")
export class JournalSecurityController {
  constructor(private readonly service: JournalSecurityService) {}

  @Get("keys")
  async getKeys(@Req() req: StageholderRequest) {
    return this.service.getKeys(req.user.sub);
  }

  @RequiresIntrospection()
  @Post("setup")
  async setup(
    @Req() req: StageholderRequest,
    @Body(new ZodValidationPipe(SetupEncryptionDto))
    dto: SetupEncryptionDto,
  ) {
    await this.service.setup(req.user.sub, dto);
    return { success: true };
  }

  @RequiresIntrospection()
  @Put("passphrase")
  async changePassphrase(
    @Req() req: StageholderRequest,
    @Body(new ZodValidationPipe(ChangePassphraseDto))
    dto: ChangePassphraseDto,
  ) {
    await this.service.changePassphrase(req.user.sub, dto);
    return { success: true };
  }

  // Recover is rate-limited independently of the global throttler: five
  // attempts per hour per authenticated user is plenty for legit recovery
  // while making online brute-force of 8 codes infeasible.
  @RequiresIntrospection()
  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } })
  @Post("recover")
  async recover(
    @Req() req: StageholderRequest,
    @Body(new ZodValidationPipe(RecoverDto)) dto: RecoverDto,
  ) {
    return this.service.recover(req.user.sub, dto.codes);
  }

  @RequiresIntrospection()
  @Post("recover/finalize")
  async finalizeRecovery(
    @Req() req: StageholderRequest,
    @Body(new ZodValidationPipe(FinalizeRecoveryDto))
    dto: FinalizeRecoveryDto,
  ) {
    await this.service.finalizeRecovery(req.user.sub, dto);
    return { success: true };
  }
}
