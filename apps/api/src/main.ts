import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import express from "express";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { validateEnv } from "./config/env.validation";
import { GlobalExceptionFilter } from "./common/filters/http-exception.filter";

function parseOrigins(raw: string | undefined): string | string[] {
  if (!raw) {
    if (process.env.NODE_ENV === "production")
      throw new Error("FRONTEND_URL required in production");
    return "http://localhost:3000";
  }
  const origins = raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return origins.length === 1 ? origins[0] : origins;
}

async function bootstrap() {
  validateEnv();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.use(helmet());
  app.use(cookieParser());
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
    const { DocumentBuilder, SwaggerModule } = await import("@nestjs/swagger");
    const config = new DocumentBuilder()
      .setTitle("Meridian API")
      .setVersion("0.1.0")
      .addBearerAuth()
      .addCookieAuth("access_token")
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("docs", app, document);
  }

  const port = process.env.PORT || 4000;
  await app.listen(port);
  const logger = app.get(Logger);
  logger.log(`Meridian API running on http://localhost:${port}`);
}

bootstrap();
