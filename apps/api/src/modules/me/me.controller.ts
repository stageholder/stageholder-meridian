import { Controller, Get, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { StageholderRequest } from "../../common/types";
import { getPersonalOrgId } from "../../common/helpers/personal-org";
import { getMeridianLimit } from "../../common/helpers/entitlement";

const PRODUCT_SLUG = "meridian";

@ApiTags("Me")
@Controller("me")
export class MeController {
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
