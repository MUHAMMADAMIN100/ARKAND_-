import 'reflect-metadata';
import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useLogger(app.get(PinoLogger));

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT') ?? 3001;
  const isProd = config.get<string>('NODE_ENV') === 'production';
  const frontendOrigin = config.get<string>('FRONTEND_ORIGIN') ?? 'http://localhost:5173';

  // За прокси Railway берём реальный IP клиента из X-Forwarded-For (нужно для rate-limit и аудита).
  app.set('trust proxy', 1);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  // CORS: раздельные домены Vercel (front) ↔ Railway (api). Токены в заголовке Authorization.
  const origins = frontendOrigin.split(',').map((o) => o.trim());
  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // Валидация — через Zod-пайпы на каждом эндпоинте (ZBody/ZodQueryPipe), class-validator не используется.
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  // Swagger — только вне продакшена (не раскрываем карту API в проде).
  if (!isProd) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Щебёночный завод API')
      .setDescription('ERP-модуль холдинга Arkand — карьер. ТЗ Часть 4.')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(port, '0.0.0.0');
  const logger = app.get(PinoLogger);
  logger.log(`API слушает 0.0.0.0:${port} · health: /api/health${isProd ? '' : ' · Swagger: /api/docs'}`);
}

bootstrap().catch((err) => {
  // Причина падения на старте — напрямую в stderr (не через буфер логгера), чтобы была видна в логах деплоя.
  console.error('Ошибка старта приложения:', err);
  process.exit(1);
});
