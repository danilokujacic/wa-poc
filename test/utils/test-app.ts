// Loaded first (and only for non-DB values like JWT_SECRET): AuthModule's
// JwtModule.register({ secret: process.env.JWT_SECRET }) reads process.env
// synchronously at import/class-decoration time, before AppModule below is
// even evaluated. DB_HOST/REDIS_HOST from .env are irrelevant here — they get
// overwritten with the testcontainers values before anything reads them.
import 'dotenv/config';
import { ClassSerializerInterceptor, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { join } from 'path';
import { DataSource } from 'typeorm';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { GenericContainer } from 'testcontainers';
import { AppModule } from '../../src/app.module';
import { GlobalExceptionFilter } from '../../src/exception/global-exception.filter';

export interface TestApp {
  app: INestApplication;
  close(): Promise<void>;
}

// Deliberately does NOT load `.env` and does NOT trust whatever DB_HOST /
// REDIS_HOST happen to be set in the ambient environment — an e2e run must
// never be able to connect to a real deployment's database just because
// someone's .env (or a misconfigured CI secret) points there. Instead, every
// call spins up its own disposable Postgres + Redis via testcontainers and
// overwrites process.env with THEIR connection info before the Nest module
// graph is ever built. TypeOrmModule/BullModule read these lazily via
// ConfigService inside forRootAsync factories (evaluated during
// `.compile()`, not at import time), so setting them here — before
// `AppModule` is imported — is early enough.
export async function createTestApp(): Promise<TestApp> {
  const postgres = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('wa_poc_test')
    .withUsername('test')
    .withPassword('test')
    .start();

  const redis = await new GenericContainer('redis:7-alpine')
    .withExposedPorts(6379)
    .start();

  process.env.DB_HOST = postgres.getHost();
  process.env.DB_PORT = String(postgres.getPort());
  process.env.DB_USER = postgres.getUsername();
  process.env.DB_PASS = postgres.getPassword();
  process.env.DB_NAME = postgres.getDatabase();
  process.env.REDIS_HOST = redis.getHost();
  process.env.REDIS_PORT = String(redis.getMappedPort(6379));
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET ??= 'e2e-test-jwt-secret';

  await runMigrations(postgres);

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication({ rawBody: true });
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.use(cookieParser());
  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector), {
      excludeExtraneousValues: true,
    }),
  );
  await app.init();

  return {
    app,
    close: async () => {
      await app.close();
      await Promise.all([postgres.stop(), redis.stop()]);
    },
  };
}

async function runMigrations(
  postgres: StartedPostgreSqlContainer,
): Promise<void> {
  const dataSource = new DataSource({
    type: 'postgres',
    host: postgres.getHost(),
    port: postgres.getPort(),
    username: postgres.getUsername(),
    password: postgres.getPassword(),
    database: postgres.getDatabase(),
    entities: [join(__dirname, '../../src/**/entity/*.entity{.ts,.js}')],
    migrations: [join(__dirname, '../../src/migrations/*{.ts,.js}')],
  });
  await dataSource.initialize();
  await dataSource.runMigrations();
  await dataSource.destroy();
}
