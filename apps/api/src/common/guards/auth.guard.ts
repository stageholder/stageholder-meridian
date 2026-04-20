import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  StageholderAuthGuard,
  STAGEHOLDER_AUTH_CONFIG,
  introspectAccessToken,
  type StageholderAuthConfig,
} from "@stageholder/auth";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { IS_INTROSPECT_KEY } from "../decorators/introspect.decorator";

/**
 * Wraps the SDK's StageholderAuthGuard so that routes marked with
 * `@Public()` are allowed through without a Bearer token. Also logs the
 * specific verification failure when the SDK guard rejects — the default
 * UnauthorizedException() carries no message, which makes "why is my
 * token being rejected" impossible to diagnose from the outside.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);
  private readonly delegate: StageholderAuthGuard;
  private readonly config: StageholderAuthConfig;

  constructor(
    private readonly reflector: Reflector,
    @Inject(STAGEHOLDER_AUTH_CONFIG) config: StageholderAuthConfig,
  ) {
    this.delegate = new StageholderAuthGuard(config);
    this.config = config;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    try {
      const ok = await this.delegate.canActivate(context);
      if (!ok) return false;

      const needsIntrospection = this.reflector.getAllAndOverride<boolean>(
        IS_INTROSPECT_KEY,
        [context.getHandler(), context.getClass()],
      );
      if (needsIntrospection) {
        const req = context.switchToHttp().getRequest();
        const auth = req.headers?.authorization as string | undefined;
        const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
        if (!token) throw new UnauthorizedException();
        // Throws "Token is not active" when the Hub reports revoked/expired.
        // We swallow the specific error so we don't leak details, but the
        // warn log below records the actual reason for operators.
        try {
          await introspectAccessToken(token, this.config);
        } catch (introspectionErr) {
          this.logger.warn(
            `[auth] ${req.method} ${req.url} failed introspection: ${
              (introspectionErr as Error).message
            }`,
          );
          throw new UnauthorizedException();
        }
      }

      return true;
    } catch (err) {
      const req = context.switchToHttp().getRequest();
      const auth = req.headers?.authorization as string | undefined;
      const hasBearer = auth?.startsWith("Bearer ");
      const token = hasBearer ? auth!.slice(7) : undefined;

      let decoded:
        | { iss?: string; aud?: unknown; exp?: number; sub?: string }
        | undefined;
      if (token) {
        try {
          const payload = token.split(".")[1];
          decoded = JSON.parse(
            Buffer.from(payload, "base64").toString("utf-8"),
          );
        } catch {
          /* opaque token or malformed — leave decoded undefined */
        }
      }

      this.logger.warn(
        `[auth] ${req.method} ${req.url} rejected: ${(err as Error).message}\n` +
          `  expected issuer: ${this.config.issuerUrl}\n` +
          `  expected audience: ${this.config.audience ?? "stageholder-api"}\n` +
          `  token.iss: ${decoded?.iss ?? "<none>"}\n` +
          `  token.aud: ${JSON.stringify(decoded?.aud) ?? "<none>"}\n` +
          `  token.exp: ${
            decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : "<none>"
          }\n` +
          `  token.sub: ${decoded?.sub ?? "<none>"}\n` +
          `  bearer present: ${hasBearer ? "yes" : "no"}`,
      );

      throw new UnauthorizedException();
    }
  }
}
