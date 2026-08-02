import dotenv from 'dotenv';
dotenv.config();

import { ClassSerializerInterceptor } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './exception/global-exception.filter';
import { RedisIoAdapter } from './desk/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  // Lets BullMQ workers (e.g. DeskMessageProcessor) finish or cleanly release their
  // current job on SIGTERM instead of being killed mid-write.
  app.enableShutdownHooks();
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.use(cookieParser());
  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector), {
      excludeExtraneousValues: true,
    }),
  );

  // No silent fallback: an unset FRONTEND_URL previously defaulted to
  // localhost:3000, which meant a missing/misconfigured env var on a real
  // deployment would silently break CORS for the real frontend instead of
  // failing loudly at boot.
  if (!process.env.FRONTEND_URL) {
    throw new Error('FRONTEND_URL environment variable must be set');
  }
  app.enableCors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  });

  const redisIoAdapter = new RedisIoAdapter(app);
  redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('WA POC API')
    .setDescription('Resort and FAQ management API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
