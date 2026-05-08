import { Body, Controller, Get, Post, Put, Req } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiTags } from "@nestjs/swagger";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import type { StageholderRequest } from "../../common/types";
import { JournalSecurityService } from "./journal-security.service";
import {
  SetupEncryptionDto,
  ChangePassphraseDto,
  RecoverDto,
  FinalizeRecoveryDto,
} from "./journal-security.dto";

/**
 * These endpoints previously carried `@RequiresIntrospection()` so the SDK
 * guard would call back to the Hub's `/oidc/token/introspection` endpoint
 * after JWT verify, catching just-revoked tokens. That step requires the
 * API to authenticate to the Hub with `IDENTITY_CLIENT_ID` /
 * `IDENTITY_CLIENT_SECRET` registered there as an introspection-privileged
 * client — which it isn't in this deployment, so every protected call
 * 401'd at the introspection step.
 *
 * Removed because: (a) the rest of the API relies on JWT verify alone, so
 * journal-security ops weren't actually meaningfully more guarded than the
 * rest of the app, and (b) the threat introspection guards against (a token
 * stolen *and* revoked-but-not-yet-expired, in the 5-15 min access-token
 * TTL window) is narrow for personal-productivity ops. JWT verify still
 * applies and continues to enforce signature/expiry/audience/issuer.
 *
 * To restore introspection later: re-add `@RequiresIntrospection()` after
 * verifying the Hub-side client registration grants introspection privilege
 * and that `IDENTITY_CLIENT_ID` / `IDENTITY_CLIENT_SECRET` are set on the
 * Cloud Run service to match.
 */
@ApiTags("Journal Security")
@Controller("journal-security")
export class JournalSecurityController {
  constructor(private readonly service: JournalSecurityService) {}

  @Get("keys")
  async getKeys(@Req() req: StageholderRequest) {
    return this.service.getKeys(req.user.sub);
  }

  @Post("setup")
  async setup(
    @Req() req: StageholderRequest,
    @Body(new ZodValidationPipe(SetupEncryptionDto))
    dto: SetupEncryptionDto,
  ) {
    await this.service.setup(req.user.sub, dto);
    return { success: true };
  }

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
  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } })
  @Post("recover")
  async recover(
    @Req() req: StageholderRequest,
    @Body(new ZodValidationPipe(RecoverDto)) dto: RecoverDto,
  ) {
    return this.service.recover(req.user.sub, dto.codes);
  }

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
