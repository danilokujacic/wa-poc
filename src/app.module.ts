import { Module } from '@nestjs/common';
import { join } from 'path';
import { AppService } from './app.service';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { ResortModule } from './resort/resort.module';
import { FaqModule } from './faq/faq.module';
import { ResortFeatureModule } from './resort-feature/resort-feature.module';
import { ResortContactModule } from './resort-contact/resort-contact.module';
import { ReservationModule } from './reservation/reservation.module';
import { UsersModule } from './users/users.module';
import { PhoneChangeModule } from './phone-change/phone-change.module';
import { DeskModule } from './desk/desk.module';
// import { BullmqModule } from './bullmq/bullmq.module';
import { AuthModule } from './auth/auth.module';
import { ChannexModule } from './channex/channex.module';
import { HealthModule } from './health/health.module';
import { RatePeriodModule } from './rate-period/rate-period.module';
import appConfig from './config/app.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        pinoHttp: {
          level: 'debug',
          customSuccessMessage: (req, res) =>
            `${req.method} ${req.url} ${res.statusCode}`,
          customErrorMessage: (req, res, err) =>
            `${req.method} ${req.url} ${res.statusCode} - ${err.message}`,
          // Structural safety net, not the primary control: message/guest content should never be
          // passed to the logger in the first place (see the trace-id work across the messaging
          // pipeline), but this redacts common content-shaped fields if a future log call slips one
          // in anyway, before it ever reaches the Loki transport below.
          redact: {
            paths: [
              'req.body',
              'req.headers.authorization',
              'req.headers.cookie',
              'body',
              'text',
              'combined',
              'rawReply',
              'reply',
            ],
            censor: '[REDACTED]',
          },
          transport: {
            targets: [
              {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  singleLine: true,
                  translateTime: 'HH:MM:ss',
                  ignore: 'pid,hostname,req,res',
                },
                level: 'debug',
              },
              ...(process.env.NODE_ENV === 'production'
                ? [
                    {
                      target: 'pino-loki',
                      options: {
                        host: configService.get<string>(
                          'LOKI_HOST',
                          'http://localhost:3100',
                        ),
                        labels: {
                          service: configService.get<string>('app.name'),
                        },
                        batching: true,
                        interval: 5, // push every 5s
                      },
                      level: 'info',
                    },
                  ]
                : []),
            ],
          },
        },
      }),
    }),
    WhatsappModule,
    ResortModule,
    FaqModule,
    ResortFeatureModule,
    ResortContactModule,
    ReservationModule,
    UsersModule,
    PhoneChangeModule,
    DeskModule,
    ChannexModule,
    RatePeriodModule,
    HealthModule,
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: Number(process.env.WEBHOOK_RATE_LIMIT_WINDOW_MS ?? 60_000),
        limit: Number(process.env.WEBHOOK_RATE_LIMIT_MAX ?? 120),
      },
    ]),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
      },
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get('DB_USER', 'postgres'),
        password: config.get('DB_PASS', 'postgres'),
        database: config.get('DB_NAME', 'wa_poc'),
        // Neon (and most managed Postgres) requires SSL; local/self-hosted
        // Postgres in docker-compose doesn't have it configured at all, so
        // this must be opt-in via env var, not always-on. rejectUnauthorized:
        // false because Neon's cert chain isn't in Node's default trust
        // store by default — this still encrypts the connection, it just
        // doesn't verify the server certificate against a CA.
        ssl:
          config.get('DB_SSL', 'false') === 'true'
            ? { rejectUnauthorized: false }
            : false,
        entities: [join(__dirname, '**/entity/*.entity{.ts,.js}')],
        synchronize: process.env.NODE_ENV === 'development', // DEV ONLY — auto-creates tables from entities
      }),
    }),
    AuthModule,
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
  ],
  providers: [
    AppService,
    // Loose, generous safety net applied to every route by default (same
    // "default" throttler config above, per-IP tracking) — not meant to
    // stop determined abuse on its own, just to make sure no route is
    // completely unprotected by accident. Routes with real stakes (auth,
    // webhooks, desk) layer a tighter, route-specific guard on top via
    // @Throttle(...)/their own guard subclass; this doesn't replace those.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
