import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import express from "express";
import { Logger } from "nestjs-pino";
import { StageholderWebhookExceptionFilter } from "@stageholder/sdk/nestjs";
import { AppModule } from "./app.module";
import { validateEnv } from "./config/env.validation";
import { GlobalExceptionFilter } from "./common/filters/http-exception.filter";

// Tauri webview origins vary by OS:
//   macOS/Linux → tauri://localhost
//   Windows     → http://tauri.localhost
// Both need allow-listing so the desktop app can call the API directly with
// its Bearer token (web goes through the BFF proxy on the same origin and
// doesn't trigger CORS preflight).
const TAURI_ORIGINS = ["tauri://localhost", "http://tauri.localhost"];

function parseOrigins(raw: string | undefined): string[] {
  const parsed =
    raw
      ?.split(",")
      .map((o) => o.trim())
      .filter(Boolean) ?? [];

  if (parsed.length === 0) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FRONTEND_URL required in production");
    }
    // Dev default: PWA on 4001 after the Hub integration port shuffle.
    parsed.push("http://localhost:4001");
  }

  return [...parsed, ...TAURI_ORIGINS];
}

async function bootstrap() {
  validateEnv();
  // `rawBody: true` preserves the original request bytes on `req.rawBody`,
  // which `StageholderWebhookGuard` requires for HMAC signature verification.
  // Without it, the JSON body parser strips the raw bytes and verification
  // always fails.
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  // Order matters: the webhook filter is more specific (catches only SDK
  // webhook errors) and must run before the catch-all GlobalExceptionFilter
  // so signature/replay errors map to 401/400 instead of 500.
  app.useGlobalFilters(
    new StageholderWebhookExceptionFilter(),
    new GlobalExceptionFilter(),
  );
  app.use(helmet());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  app.setGlobalPrefix("api/v1");
  app.enableCors({
    origin: parseOrigins(process.env.FRONTEND_URL),
    credentials: true,
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
