import { Module } from '@nestjs/common';
import { join } from 'path';
import { AppService } from './app.service';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ResortModule } from './resort/resort.module';
import { FaqModule } from './faq/faq.module';
import { ResortFeatureModule } from './resort-feature/resort-feature.module';
import { ResortContactModule } from './resort-contact/resort-contact.module';
import { ReservationModule } from './reservation/reservation.module';
// import { BullmqModule } from './bullmq/bullmq.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [WhatsappModule, ResortModule, FaqModule, ResortFeatureModule, ResortContactModule, ReservationModule, ThrottlerModule.forRoot([
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
  }), AuthModule,],
  providers: [AppService],
})
export class AppModule { }
