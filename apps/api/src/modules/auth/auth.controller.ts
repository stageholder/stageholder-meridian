import { Controller, Post, Get, Patch, Body, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, SocialLoginDto } from './auth.dto';
import { RegisterDto as RegisterSchema, LoginDto as LoginSchema, SocialLoginDto as SocialLoginSchema } from './auth.dto';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUserId } from '../../common/decorators/current-user.decorator';
import { setAuthCookies, clearAuthCookies, getRefreshTokenFromCookie } from '../../common/utils/auth-cookies.util';
import { User } from '../user/user.entity';

function isBearerClient(req: Request): boolean {
  return req.headers['x-auth-strategy'] === 'bearer';
}

function toUserResponse(user: User) {
  const obj = user.toObject();
  return { id: obj.id, email: obj.email, name: obj.name, avatar: obj.avatar, timezone: obj.timezone, provider: obj.provider, emailVerified: obj.emailVerified, createdAt: obj.createdAt };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body(new ZodValidationPipe(RegisterSchema)) dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { user, tokens } = await this.authService.register(dto);
    if (isBearerClient(req)) {
      return { ...toUserResponse(user), accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
    }
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return toUserResponse(user);
  }

  @Public()
  @Post('login')
  async login(@Body(new ZodValidationPipe(LoginSchema)) dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { user, tokens } = await this.authService.login(dto);
    if (isBearerClient(req)) {
      return { ...toUserResponse(user), accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
    }
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return toUserResponse(user);
  }

  @Public()
  @Post('social')
  async socialLogin(@Body(new ZodValidationPipe(SocialLoginSchema)) dto: SocialLoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { user, tokens } = await this.authService.socialLogin(dto);
    if (isBearerClient(req)) {
      return { ...toUserResponse(user), accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
    }
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return toUserResponse(user);
  }

  @Public()
  @Post('refresh')
  async refresh(@Req() req: Request, @Body() body: { refreshToken?: string }, @Res({ passthrough: true }) res: Response) {
    const refreshToken = getRefreshTokenFromCookie(req) || body.refreshToken;
    if (!refreshToken) { clearAuthCookies(res); return { error: 'No refresh token' }; }
    const { user, tokens } = await this.authService.refreshToken(refreshToken);
    if (isBearerClient(req)) {
      return { ...toUserResponse(user), accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
    }
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return toUserResponse(user);
  }

  @Post('logout')
  async logout(@CurrentUserId() userId: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(userId);
    clearAuthCookies(res);
    return { success: true };
  }

  @Get('me')
  async me(@CurrentUserId() userId: string) {
    const user = await this.authService.getProfile(userId);
    return toUserResponse(user);
  }

  @Patch('me')
  async updateProfile(@CurrentUserId() userId: string, @Body() body: { name?: string; avatar?: string; timezone?: string }) {
    const user = await this.authService.updateProfile(userId, body);
    return toUserResponse(user);
  }
}
