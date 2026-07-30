import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Resort } from '../entity/resort.entity';
import { ResortFeature } from '../entity/resort-feature.entity';
import { Reservation } from '../entity/reservation.entity';
import { ResortRepository } from '../repository/resort.repository';
import { ResortFeatureRepository } from '../repository/resort-feature.repository';
import { ReservationRepository } from '../repository/reservation.repository';
import { ChannexApiClient } from './channex-api.client';
import { ChannexBookingSyncService } from './channex-booking-sync.service';
import { ChannexContentSyncService } from './channex-content-sync.service';
import { ChannexController } from './channex.controller';
import { ChannexFeedPollScheduler } from './channex-feed-poll.scheduler';
import { ChannexWebhookGuard } from './guards/channex-webhook.guard';
import { ChannexWebhookThrottlerGuard } from './guards/channex-webhook-throttler.guard';

@Module({
    imports: [TypeOrmModule.forFeature([Resort, ResortFeature, Reservation])],
    controllers: [ChannexController],
    providers: [
        ResortRepository,
        ResortFeatureRepository,
        ReservationRepository,
        ChannexApiClient,
        ChannexBookingSyncService,
        ChannexContentSyncService,
        ChannexFeedPollScheduler,
        ChannexWebhookGuard,
        ChannexWebhookThrottlerGuard,
    ],
    exports: [ChannexContentSyncService],
})
export class ChannexModule { }
