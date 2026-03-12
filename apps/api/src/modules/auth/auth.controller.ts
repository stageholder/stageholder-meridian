import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Query,
  Req,
  Res,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiTags } from "@nestjs/swagger";
import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import {
  RegisterDto,
  LoginDto,
  SocialLoginDto,
  RefreshDto,
  UpdateProfileDto,
} from "./auth.dto";
import {
  RegisterDto as RegisterSchema,
  LoginDto as LoginSchema,
  SocialLoginDto as SocialLoginSchema,
  RefreshDto as RefreshSchema,
  UpdateProfileDto as UpdateProfileSchema,
} from "./auth.dto";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { Public } from "../../common/decorators/public.decorator";
import { CurrentUserId } from "../../common/decorators/current-user.decorator";
import {
  setAuthCookies,
  clearAuthCookies,
  getRefreshTokenFromCookie,
} from "../../common/utils/auth-cookies.util";
import { User } from "../user/user.entity";

function isBearerClient(req: Request): boolean {
  return req.headers["x-auth-strategy"] === "bearer";
}

function toUserResponse(user: User) {
  const obj = user.toObject();
  return {
    id: obj.id,
    email: obj.email,
    name: obj.name,
    avatar: obj.avatar,
    timezone: obj.timezone,
    provider: obj.provider,
    emailVerified: obj.emailVerified,
    onboardingCompleted: obj.onboardingCompleted,
    createdAt: obj.createdAt,
  };
}

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Public()
  @Post("register")
  async register(
    @Body(new ZodValidationPipe(RegisterSchema)) dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens, personalWorkspaceShortId } =
      await this.authService.register(dto);
    if (isBearerClient(req)) {
      return {
        ...toUserResponse(user),
        personalWorkspaceShortId,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    }
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return { ...toUserResponse(user), personalWorkspaceShortId };
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Public()
  @Post("login")
  async login(
    @Body(new ZodValidationPipe(LoginSchema)) dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens, personalWorkspaceShortId } =
      await this.authService.login(dto);
    if (isBearerClient(req)) {
      return {
        ...toUserResponse(user),
        personalWorkspaceShortId,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    }
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return { ...toUserResponse(user), personalWorkspaceShortId };
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Public()
  @Post("social")
  async socialLogin(
    @Body(new ZodValidationPipe(SocialLoginSchema)) dto: SocialLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens, personalWorkspaceShortId } =
      await this.authService.socialLogin(dto);
    if (isBearerClient(req)) {
      return {
        ...toUserResponse(user),
        personalWorkspaceShortId,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    }
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return { ...toUserResponse(user), personalWorkspaceShortId };
  }

  @Public()
  @Get("google")
  async googleRedirect(
    @Query("redirect_uri") redirectUri: string,
    @Query("client_type") clientType: "web" | "desktop",
    @Res() res: Response,
  ) {
    const url = this.authService.getGoogleAuthUrl(
      redirectUri,
      clientType || "web",
    );
    res.redirect(url);
  }

  @Public()
  @Get("google/callback")
  async googleCallback(
    @Query("code") code: string,
    @Query("state") stateParam: string,
    @Res() res: Response,
  ) {
    // Parse JSON state (with fallback for plain-string backward compat)
    let redirectUri = "";
    let clientType = "web";
    try {
      const parsed = JSON.parse(stateParam);
      redirectUri = parsed.redirectUri || "";
      clientType = parsed.clientType || "web";
    } catch {
      redirectUri = stateParam;
    }

    const { user, tokens, personalWorkspaceShortId } =
      await this.authService.exchangeGoogleCode(code, redirectUri);

    const userJson = encodeURIComponent(
      JSON.stringify({ ...toUserResponse(user), personalWorkspaceShortId }),
    );
    const redirectPath = !user.onboardingCompleted
      ? "/onboarding"
      : personalWorkspaceShortId
        ? `/${personalWorkspaceShortId}/dashboard`
        : "/workspaces";

    if (clientType === "desktop") {
      // Validate localhost redirect to prevent open redirect
      if (!/^http:\/\/localhost:\d+/.test(redirectUri)) {
        throw new BadRequestException("Invalid desktop redirect URI");
      }
      // Desktop: redirect to localhost with tokens (no cookies)
      const params = new URLSearchParams({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        user: userJson,
        redirect: redirectPath,
      });
      return res.redirect(`${redirectUri}?${params.toString()}`);
    }

    // Web: existing cookie-based flow
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    const frontendUrl = this.authService.getFrontendUrl();
    res.redirect(
      `${frontendUrl}/auth/google/callback?user=${userJson}&redirect=${encodeURIComponent(redirectPath)}`,
    );
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Public()
  @Post("refresh")
  async refresh(
    @Req() req: Request,
    @Body(new ZodValidationPipe(RefreshSchema)) body: RefreshDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = getRefreshTokenFromCookie(req) || body.refreshToken;
    if (!refreshToken) {
      clearAuthCookies(res);
      throw new UnauthorizedException("No refresh token provided");
    }
    const { user, tokens } = await this.authService.refreshToken(refreshToken);
    if (isBearerClient(req)) {
      return {
        ...toUserResponse(user),
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };
    }
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return toUserResponse(user);
  }

  @Post("logout")
  async logout(
    @CurrentUserId() userId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(userId);
    clearAuthCookies(res);
    return { success: true };
  }

  @Get("me")
  async me(@CurrentUserId() userId: string) {
    const user = await this.authService.getProfile(userId);
    return toUserResponse(user);
  }

  @Patch("me")
  async updateProfile(
    @CurrentUserId() userId: string,
    @Body(new ZodValidationPipe(UpdateProfileSchema)) body: UpdateProfileDto,
  ) {
    const user = await this.authService.updateProfile(userId, body);
    return toUserResponse(user);
  }

  @Post("onboarding/complete")
  async completeOnboarding(@CurrentUserId() userId: string) {
    const { user, personalWorkspaceShortId } =
      await this.authService.completeOnboarding(userId);
    return { ...toUserResponse(user), personalWorkspaceShortId };
  }
}
