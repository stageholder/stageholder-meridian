import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Logger } from "nestjs-pino";
import {
  StageholderWebhookExceptionFilter,
  getTauriCorsOrigins,
} from "@stageholder/sdk/nestjs";
import { AppModule } from "./app.module";
import { validateEnv } from "./config/env.validation";
import { requestTimezoneMiddleware } from "./common/request-timezone";
import { GlobalExceptionFilter } from "./common/filters/http-exception.filter";

function parseOrigins(raw: string | undefined): string[] {
  const parsed =
    raw
      ?.split(",")
      .map((o) => o.trim())
      .filter(Boolean) ?? [];

  if (parsed.length === 0) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("CORS_ORIGINS or FRONTEND_URL required in production");
    }
    // Dev default: PWA on 4001 after the Vite SPA migration.
    parsed.push("http://localhost:4001");
  }

  // `getTauriCorsOrigins()` returns the canonical Tauri webview origins
  // (`tauri://localhost` macOS/Linux, `http://tauri.localhost` Windows).
  // Both need allow-listing so the desktop app — which now mounts the PWA
  // Vite source tree directly and calls this API cross-origin with a
  // Bearer token — can hit the API. Same code path as the web SPA.
  return [...parsed, ...getTauriCorsOrigins()];
}

async function bootstrap() {
  validateEnv();
  // `rawBody: true` preserves the original request bytes on `req.rawBody`,
  // which `StageholderWebhookGuard` requires for HMAC signature verification.
  // Without it, the JSON body parser strips the raw bytes and verification
  // always fails.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  // Order matters: Nest tries global filters in REVERSE registration order,
  // so the catch-all GlobalExceptionFilter goes FIRST and the specific webhook
  // filter LAST (= tried first). The reverse order let the catch-all win and
  // turned every webhook signature/replay error into a 500 instead of 401/400.
  app.useGlobalFilters(
    new GlobalExceptionFilter(),
    new StageholderWebhookExceptionFilter(),
  );
  app.use(helmet());
  // Nest's own parsers (NOT `app.use(express.json())`): only these capture
  // `req.rawBody` under `rawBody: true`. A plain express.json() registered here
  // parsed the body first, so rawBody was never set and EVERY Hub webhook
  // failed signature verification ("missing rawBody").
  app.useBodyParser("json", { limit: "1mb" });
  app.useBodyParser("urlencoded", { extended: true, limit: "1mb" });
  // Binds the caller's `X-Timezone` so "today" is computed in THEIR zone.
  app.use(requestTimezoneMiddleware);
  app.setGlobalPrefix("api/v1");
  // SPA cutover: the PWA now calls this API cross-origin with
  // `Authorization: Bearer <access-token>` injected by `@stageholder/sdk/spa`.
  // No cookies cross — `credentials: false`. Allowed headers are explicit so
  // CORS preflight doesn't reject the SDK's auth header, request-id, or
  // idempotency-key. `CORS_ORIGINS` is the canonical multi-origin env var;
  // `FRONTEND_URL` stays as a single-origin fallback.
  app.enableCors({
    origin: parseOrigins(process.env.CORS_ORIGINS ?? process.env.FRONTEND_URL),
    credentials: false,
    allowedHeaders: [
      "Authorization",
      "Content-Type",
      "X-Request-Id",
      "X-Idempotency-Key",
      "X-Timezone",
    ],
    exposedHeaders: ["Content-Disposition", "Content-Type", "X-Request-Id"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  // Bare /health for Docker healthcheck (outside global prefix)
  const httpAdapter = app.getHttpAdapter().getInstance();
  const bareHealth = (_req: any, res: any) =>
    res.status(200).json({ status: "ok" });
  httpAdapter.get("/health", bareHealth);
  httpAdapter.head("/health", bareHealth);

  // Swagger docs (dev/staging only)
  if (process.env.NODE_ENV !== "production") {
    try {
      const { DocumentBuilder, SwaggerModule } =
        await import("@nestjs/swagger");
      const config = new DocumentBuilder()
        .setTitle("Meridian API")
        .setVersion("0.1.0")
        .addBearerAuth()
        .build();
      const document = SwaggerModule.createDocument(app, config, {
        operationIdFactory: (_controllerKey, methodKey) => methodKey,
      });
      SwaggerModule.setup("docs", app, document);
    } catch (err) {
      const logger = app.get(Logger);
      logger.warn(
        `Swagger setup failed (Zod DTOs are not class-based): ${err}`,
      );
    }
  }

  const port = process.env.PORT || 4000;
  await app.listen(port);
  const logger = app.get(Logger);
  logger.log(`Meridian API running on http://localhost:${port}`);
}

bootstrap();
