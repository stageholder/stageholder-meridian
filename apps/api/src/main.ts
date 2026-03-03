import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { AppModule } from './app.module';
import { validateEnv } from './config/env.validation';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

function parseOrigins(raw: string | undefined): string | string[] {
  if (!raw) {
    if (process.env.NODE_ENV === 'production') throw new Error('FRONTEND_URL required in production');
    return 'http://localhost:3000';
  }
  const origins = raw.split(',').map((o) => o.trim()).filter(Boolean);
  return origins.length === 1 ? origins[0] : origins;
}

async function bootstrap() {
  validateEnv();
  const app = await NestFactory.create(AppModule);

  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/health', (_req: any, res: any) => {
    const dbState = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const status = dbState === 'connected' ? 200 : 503;
    res.status(status).json({ status: status === 200 ? 'ok' : 'degraded', db: dbState });
  });

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: parseOrigins(process.env.FRONTEND_URL),
    credentials: true,
  });

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`Meridian API running on http://localhost:${port}`);
}

bootstrap();
