import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
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

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.use(helmet());
  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: parseOrigins(process.env.FRONTEND_URL),
    credentials: true,
  });

  const httpAdapter = app.getHttpAdapter();
  const healthHandler = (_req: any, res: any) => {
    res.status(200).json({ status: 'ok' });
  };
  httpAdapter.get('/health', healthHandler);
  httpAdapter.get('/api/v1/health', healthHandler);

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`Meridian API running on http://localhost:${port}`);
}

bootstrap();
