import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as jwt from "jsonwebtoken";
import * as bcrypt from "bcryptjs";
import { createHash, randomUUID } from "crypto";
import { OAuth2Client } from "google-auth-library";
import { UserService } from "../user/user.service";
import { User } from "../user/user.entity";
import { UserModel, UserDocument } from "../user/user.schema";
import { RegisterDto, LoginDto, SocialLoginDto } from "./auth.dto";
import { WorkspaceService } from "../workspace/workspace.service";

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string;
  private readonly refreshExpiresIn: number;
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly userService: UserService,
    private readonly workspaceService: WorkspaceService,
    private readonly config: ConfigService,
    @InjectModel(UserModel.name) private userModel: Model<UserDocument>,
  ) {
    this.jwtSecret = this.config.getOrThrow<string>("JWT_SECRET");
    this.jwtExpiresIn = this.config.get<string>("JWT_EXPIRES_IN", "15m");
    this.refreshExpiresIn = parseInt(
      this.config.get<string>("REFRESH_TOKEN_EXPIRES_IN", "30"),
      10,
    );
    this.googleClient = new OAuth2Client(
      this.config.get<string>("GOOGLE_CLIENT_ID"),
    );
  }

  async register(dto: RegisterDto): Promise<{
    user: User;
    tokens: TokenPair;
    personalWorkspaceShortId: string;
  }> {
    const hash = await bcrypt.hash(dto.password, 12);
    const user = await this.userService.createLocal(dto.email, dto.name, hash);
    const personalWs = await this.workspaceService.createPersonal(
      user.id,
      user.email,
      user.name,
    );
    const tokens = await this.generateTokenPair(user);
    return { user, tokens, personalWorkspaceShortId: personalWs.shortId };
  }

  async login(dto: LoginDto): Promise<{
    user: User;
    tokens: TokenPair;
    personalWorkspaceShortId?: string;
  }> {
    const user = await this.userService.findByEmail(dto.email);
    if (!user || !user.passwordHash)
      throw new UnauthorizedException("Invalid email or password");
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException("Invalid email or password");
    const personalWs = await this.workspaceService.findPersonalByOwner(user.id);
    const tokens = await this.generateTokenPair(user);
    return { user, tokens, personalWorkspaceShortId: personalWs?.shortId };
  }

  async socialLogin(dto: SocialLoginDto): Promise<{
    user: User;
    tokens: TokenPair;
    personalWorkspaceShortId: string;
  }> {
    if (dto.provider !== "google")
      throw new BadRequestException("Unsupported provider");
    const googleClientId = this.config.get<string>("GOOGLE_CLIENT_ID");
    if (!googleClientId)
      throw new BadRequestException("Google OAuth not configured");

    let email: string;
    let name: string;
    let sub: string;
    let picture: string | undefined;

    if (dto.idToken) {
      const ticket = await this.googleClient
        .verifyIdToken({
          idToken: dto.idToken,
          audience: googleClientId,
        })
        .catch(() => {
          throw new UnauthorizedException("Invalid Google ID token");
        });
      const payload = ticket.getPayload();
      if (!payload || !payload.email || !payload.sub)
        throw new UnauthorizedException("Invalid Google token payload");
      email = payload.email;
      name = payload.name || payload.email.split("@")[0];
      sub = payload.sub;
      picture = payload.picture;
    } else if (dto.accessToken) {
      const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${dto.accessToken}` },
      });
      if (!res.ok)
        throw new UnauthorizedException("Invalid Google access token");
      const profile = await res.json();
      if (!profile.email || !profile.sub)
        throw new UnauthorizedException("Invalid Google profile");
      email = profile.email;
      name = profile.name || profile.email.split("@")[0];
      sub = profile.sub;
      picture = profile.picture;
    } else {
      throw new BadRequestException(
        "Either idToken or accessToken is required",
      );
    }

    const user = await this.userService.findOrCreateGoogle(
      email,
      name,
      sub,
      picture,
    );
    const personalWs = await this.workspaceService.createPersonal(
      user.id,
      user.email,
      user.name,
    );
    const tokens = await this.generateTokenPair(user);
    return { user, tokens, personalWorkspaceShortId: personalWs.shortId };
  }

  getFrontendUrl(): string {
    return this.config.get<string>("FRONTEND_URL", "http://localhost:3000");
  }

  getGoogleAuthUrl(
    redirectUri: string,
    clientType: "web" | "desktop" = "web",
  ): string {
    const googleClientId = this.config.get<string>("GOOGLE_CLIENT_ID");
    if (!googleClientId)
      throw new BadRequestException("Google OAuth not configured");
    const callbackUrl =
      this.config.get<string>(
        "API_URL",
        `http://localhost:${this.config.get("PORT", "4000")}`,
      ) + "/api/v1/auth/google/callback";
    const state = JSON.stringify({
      redirectUri: redirectUri || "",
      clientType,
    });
    const params = new URLSearchParams({
      client_id: googleClientId,
      redirect_uri: callbackUrl,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "select_account",
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeGoogleCode(
    code: string,
    _redirectUri: string,
  ): Promise<{
    user: User;
    tokens: TokenPair;
    personalWorkspaceShortId: string;
  }> {
    const googleClientId = this.config.get<string>("GOOGLE_CLIENT_ID");
    const googleClientSecret = this.config.get<string>("GOOGLE_CLIENT_SECRET");
    if (!googleClientId || !googleClientSecret)
      throw new BadRequestException("Google OAuth not configured");
    const callbackUrl =
      this.config.get<string>(
        "API_URL",
        `http://localhost:${this.config.get("PORT", "4000")}`,
      ) + "/api/v1/auth/google/callback";

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: googleClientId,
        client_secret: googleClientSecret,
        redirect_uri: callbackUrl,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token)
      throw new UnauthorizedException(
        "Failed to exchange Google authorization code",
      );

    const profileRes = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      },
    );
    if (!profileRes.ok)
      throw new UnauthorizedException("Failed to fetch Google profile");
    const profile = await profileRes.json();
    if (!profile.email || !profile.sub)
      throw new UnauthorizedException("Invalid Google profile");

    const user = await this.userService.findOrCreateGoogle(
      profile.email,
      profile.name || profile.email.split("@")[0],
      profile.sub,
      profile.picture,
    );
    const personalWs = await this.workspaceService.createPersonal(
      user.id,
      user.email,
      user.name,
    );
    const tokens = await this.generateTokenPair(user);
    return { user, tokens, personalWorkspaceShortId: personalWs.shortId };
  }

  async refreshToken(
    refreshToken: string,
  ): Promise<{ user: User; tokens: TokenPair }> {
    const tokenHash = this.hashRefreshToken(refreshToken);

    // Check current hash first, then grace-period previous hash
    let doc = await this.userModel
      .findOne({ refresh_token_hash: tokenHash })
      .lean();

    if (!doc) {
      doc = await this.userModel
        .findOne({
          prev_refresh_token_hash: tokenHash,
          prev_refresh_token_expires_at: { $gt: new Date() },
        })
        .lean();
    }

    if (!doc)
      throw new UnauthorizedException("Invalid or expired refresh token");

    // Enforce server-side expiry
    if (
      doc.refresh_token_expires_at &&
      new Date(doc.refresh_token_expires_at) < new Date()
    ) {
      await this.userModel.updateOne(
        { _id: doc._id },
        {
          $unset: {
            refresh_token_hash: 1,
            refresh_token_expires_at: 1,
            prev_refresh_token_hash: 1,
            prev_refresh_token_expires_at: 1,
          },
        },
      );
      throw new UnauthorizedException("Refresh token has expired");
    }

    const user = await this.userService.findById(doc._id as string);
    if (!user) throw new UnauthorizedException("User not found");
    const tokens = await this.generateTokenPair(user);
    return { user, tokens };
  }

  async logout(userId: string): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId },
      {
        $unset: {
          refresh_token_hash: 1,
          refresh_token_expires_at: 1,
          prev_refresh_token_hash: 1,
          prev_refresh_token_expires_at: 1,
        },
      },
    );
  }

  async getProfile(userId: string): Promise<User> {
    const user = await this.userService.findById(userId);
    if (!user) throw new UnauthorizedException("User not found");
    return user;
  }

  async completeOnboarding(
    userId: string,
  ): Promise<{ user: User; personalWorkspaceShortId: string }> {
    const user = await this.getProfile(userId);
    user.completeOnboarding();
    await this.userService.updateUser(user);
    const personalWs = await this.workspaceService.findPersonalByOwner(userId);
    return { user, personalWorkspaceShortId: personalWs?.shortId || "" };
  }

  async updateProfile(
    userId: string,
    dto: { name?: string; avatar?: string; timezone?: string },
  ): Promise<User> {
    const user = await this.getProfile(userId);
    if (dto.name) user.updateName(dto.name);
    if (dto.avatar !== undefined) user.updateAvatar(dto.avatar);
    if (dto.timezone !== undefined) user.updateTimezone(dto.timezone);
    await this.userService.updateUser(user);
    return user;
  }

  private async generateTokenPair(user: User): Promise<TokenPair> {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn,
    } as jwt.SignOptions);
    const refreshToken = randomUUID();
    const hash = this.hashRefreshToken(refreshToken);
    await this.storeRefreshToken(user.id, hash);
    return { accessToken, refreshToken };
  }

  private hashRefreshToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private static readonly GRACE_PERIOD_SECONDS = 30;

  private async storeRefreshToken(userId: string, hash: string): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.refreshExpiresIn);

    // Keep the current hash as a grace-period fallback for concurrent requests
    const current = await this.userModel
      .findById(userId)
      .select("refresh_token_hash")
      .lean();

    const graceExpiry = new Date(
      Date.now() + AuthService.GRACE_PERIOD_SECONDS * 1000,
    );

    await this.userModel.updateOne(
      { _id: userId },
      {
        $set: {
          refresh_token_hash: hash,
          refresh_token_expires_at: expiresAt,
          ...(current?.refresh_token_hash
            ? {
                prev_refresh_token_hash: current.refresh_token_hash,
                prev_refresh_token_expires_at: graceExpiry,
              }
            : {}),
        },
      },
    );
  }
}
