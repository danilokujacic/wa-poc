import { Module } from '@nestjs/common';
import { join } from 'path';
import { AppService } from './app.service';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
import appConfig from './config/app.config';

@Module({
  imports: [ConfigModule.forRoot({
    isGlobal: true,
    load: [appConfig],
  }), LoggerModule.forRootAsync({
    inject: [ConfigService],
    useFactory: (configService: ConfigService) => ({
      pinoHttp: {
        level: 'debug',
        customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
        customErrorMessage: (req, res, err) => `${req.method} ${req.url} ${res.statusCode} - ${err.message}`,
        // Structural safety net, not the primary control: message/guest content should never be
        // passed to the logger in the first place (see the trace-id work across the messaging
        // pipeline), but this redacts common content-shaped fields if a future log call slips one
        // in anyway, before it ever reaches the Loki transport below.
        redact: {
          paths: ['req.body', 'req.headers.authorization', 'req.headers.cookie', 'body', 'text', 'combined', 'rawReply', 'reply'],
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
            {
              target: 'pino-loki',
              options: {
                host: configService.get<string>('LOKI_HOST', 'http://localhost:3100'),
                labels: { service: configService.get<string>('app.name') },
                batching: true,
                interval: 5, // push every 5s
              },
              level: 'info',
            },
          ],
        },
      },
    }),
  }), WhatsappModule, ResortModule, FaqModule, ResortFeatureModule, ResortContactModule, ReservationModule, UsersModule, PhoneChangeModule, DeskModule, ThrottlerModule.forRoot([
    {
      name: 'default',
      ttl: Number(process.env.WEBHOOK_RATE_LIMIT_WINDOW_MS ?? 60_000),
      limit: Number(process.env.WEBHOOK_RATE_LIMIT_MAX ?? 120),
    },
  ]), BullModule.forRoot({
    connection: {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
    },
  }), TypeOrmModule.forRootAsync({
    imports: [ConfigModule],
    inject: [ConfigService],
    useFactory: (config: ConfigService) => ({
      type: 'postgres',
      host: config.get('DB_HOST', 'localhost'),
      port: config.get<number>('DB_PORT', 5432),
      username: config.get('DB_USER', 'postgres'),
      password: config.get('DB_PASS', 'postgres'),
      database: config.get('DB_NAME', 'wa_poc'),
      entities: [join(__dirname, '**/entity/*.entity{.ts,.js}')],
      synchronize: process.env.NODE_ENV === 'development',        // DEV ONLY — auto-creates tables from entities
    }),
  }), AuthModule, ScheduleModule.forRoot(), EventEmitterModule.forRoot(),],
  providers: [AppService],
})
export class AppModule { }
