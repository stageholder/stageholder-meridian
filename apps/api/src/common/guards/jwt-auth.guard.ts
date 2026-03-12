import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import * as jwt from "jsonwebtoken";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly jwtSecret: string;

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {
    this.jwtSecret = this.config.getOrThrow<string>("JWT_SECRET");
  }

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException("Authentication required");

    try {
      const payload = jwt.verify(token, this.jwtSecret);
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }

  private extractToken(request: any): string | null {
    const cookieToken = request.cookies?.access_token;
    if (cookieToken) return cookieToken;
    const authHeader = request.headers?.authorization;
    if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);
    return null;
  }
}
