import { Controller, Get, Post, Body, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { StageholderRequest } from "../../common/types";
import { getPersonalOrgId } from "../../common/helpers/personal-org";
import { getMeridianLimit } from "../../common/helpers/entitlement";
import { UserService } from "../user/user.service";
import {
  CompleteOnboardingDto as CompleteOnboardingSchema,
  type CompleteOnboardingDto,
} from "../user/user.dto";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";

const PRODUCT_SLUG = "meridian";

@ApiTags("Me")
@Controller("me")
export class MeController {
  constructor(private readonly userService: UserService) {}

  /**
   * Returns the caller's identity + authz claims (from the verified access
   * token) merged with Meridian-side state. Doubles as the JIT provisioning
   * point: creates a User document on first access.
   *
   * Returning identity/authz here lets the BFF callback drop its separate
   * `fetchUserinfo` hop to the Hub, and lets the desktop hook avoid a
   * client-side id_token decode — both sources are now already-verified
   * server-side by the Stageholder auth guard.
   */
  @Get()
  async me(@Req() req: StageholderRequest) {
    const user = await this.userService.upsertBySub(req.user.sub);
    // The Hub treats the user's first `OrgMembership` as their personal org;
    // that convention is set on the Hub and mirrored in every product.
    const personalOrg = req.user.organizations?.[0];
    return {
      sub: user.sub,
      email: req.user.email ?? null,
      name: req.user.name ?? null,
      personalOrgId: personalOrg?.id ?? null,
      personalOrgSlug: personalOrg?.slug ?? null,
      hasCompletedOnboarding: user.hasCompletedOnboarding,
    };
  }

  @Post("onboarding/complete")
  async completeOnboarding(
    @Req() req: StageholderRequest,
    @Body(new ZodValidationPipe(CompleteOnboardingSchema))
    _dto: CompleteOnboardingDto,
  ) {
    const user = await this.userService.completeOnboarding(req.user.sub);
    return {
      sub: user.sub,
      hasCompletedOnboarding: user.hasCompletedOnboarding,
    };
  }

  /**
   * Returns the caller's plan + feature limits resolved from the OIDC
   * `subscriptions` claim. Meridian is single-tier: every valid token is
   * `entitled: true`. Limits flow through `getMeridianLimit`, which
   * transparently falls back to free-tier defaults if the Hub hasn't yet
   * issued a Meridian subscription claim for this user.
   */
  @Get("entitlement")
  entitlement(@Req() req: StageholderRequest) {
    const orgId = getPersonalOrgId(req.user);
    const plan =
      req.user.subscriptions?.find(
        (s) => s.orgId === orgId && s.product === PRODUCT_SLUG,
      )?.plan ?? "meridian-free";
    return {
      plan,
      entitled: true,
      limits: {
        max_habits: getMeridianLimit(req.user, "max_habits"),
        max_todo_lists: getMeridianLimit(req.user, "max_todo_lists"),
        max_active_todos: getMeridianLimit(req.user, "max_active_todos"),
      },
    };
  }
}
