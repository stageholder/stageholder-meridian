import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import { createHash, randomUUID } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { UserService } from '../user/user.service';
import { User } from '../user/user.entity';
import { UserModel, UserDocument } from '../user/user.schema';
import { RegisterDto, LoginDto, SocialLoginDto } from './auth.dto';

interface TokenPair { accessToken: string; refreshToken: string; }
interface JwtPayload { sub: string; email: string; }

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string;
  private readonly refreshExpiresIn: number;
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly userService: UserService,
    private readonly config: ConfigService,
    @InjectModel(UserModel.name) private userModel: Model<UserDocument>,
  ) {
    this.jwtSecret = this.config.getOrThrow<string>('JWT_SECRET');
    this.jwtExpiresIn = this.config.get<string>('JWT_EXPIRES_IN', '15m');
    this.refreshExpiresIn = parseInt(this.config.get<string>('REFRESH_TOKEN_EXPIRES_IN', '7'), 10);
    this.googleClient = new OAuth2Client(this.config.get<string>('GOOGLE_CLIENT_ID'));
  }

  async register(dto: RegisterDto): Promise<{ user: User; tokens: TokenPair }> {
    const hash = await bcrypt.hash(dto.password, 12);
    const user = await this.userService.createLocal(dto.email, dto.name, hash);
    const tokens = await this.generateTokenPair(user);
    return { user, tokens };
  }

  async login(dto: LoginDto): Promise<{ user: User; tokens: TokenPair }> {
    const user = await this.userService.findByEmail(dto.email);
    if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid email or password');
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid email or password');
    const tokens = await this.generateTokenPair(user);
    return { user, tokens };
  }

  async socialLogin(dto: SocialLoginDto): Promise<{ user: User; tokens: TokenPair }> {
    if (dto.provider !== 'google') throw new BadRequestException('Unsupported provider');
    const googleClientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!googleClientId) throw new BadRequestException('Google OAuth not configured');
    const ticket = await this.googleClient.verifyIdToken({
      idToken: dto.idToken,
      audience: googleClientId,
    }).catch(() => { throw new UnauthorizedException('Invalid Google ID token'); });
    const payload = ticket.getPayload();
    if (!payload || !payload.email || !payload.sub) throw new UnauthorizedException('Invalid Google token payload');
    const user = await this.userService.findOrCreateGoogle(
      payload.email,
      payload.name || payload.email.split('@')[0],
      payload.sub,
      payload.picture,
    );
    const tokens = await this.generateTokenPair(user);
    return { user, tokens };
  }

  async refreshToken(refreshToken: string): Promise<{ user: User; tokens: TokenPair }> {
    const tokenHash = this.hashRefreshToken(refreshToken);
    const doc = await this.userModel.findOne({ refresh_token_hash: tokenHash }).lean();
    if (!doc) throw new UnauthorizedException('Invalid or expired refresh token');
    const user = await this.userService.findById(doc._id as string);
    if (!user) throw new UnauthorizedException('User not found');
    const tokens = await this.generateTokenPair(user);
    return { user, tokens };
  }

  async logout(userId: string): Promise<void> {
    await this.userModel.updateOne({ _id: userId }, { $unset: { refresh_token_hash: 1 } });
  }

  async getProfile(userId: string): Promise<User> {
    const user = await this.userService.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');
    return user;
  }

  async updateProfile(userId: string, dto: { name?: string; avatar?: string; timezone?: string }): Promise<User> {
    const user = await this.getProfile(userId);
    if (dto.name) user.updateName(dto.name);
    if (dto.avatar !== undefined) user.updateAvatar(dto.avatar);
    if (dto.timezone !== undefined) user.updateTimezone(dto.timezone);
    await this.userService.updateUser(user);
    return user;
  }

  private async generateTokenPair(user: User): Promise<TokenPair> {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = jwt.sign(payload, this.jwtSecret, { expiresIn: this.jwtExpiresIn } as jwt.SignOptions);
    const refreshToken = randomUUID();
    const hash = this.hashRefreshToken(refreshToken);
    await this.storeRefreshToken(user.id, hash);
    return { accessToken, refreshToken };
  }

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async storeRefreshToken(userId: string, hash: string): Promise<void> {
    await this.userModel.updateOne({ _id: userId }, { $set: { refresh_token_hash: hash } });
  }
}
