import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ResortFeature } from '../entity/resort-feature.entity';
import { Reservation } from '../entity/reservation.entity';
import { ResortFeatureRepository } from '../repository/resort-feature.repository';
import { ReservationRepository } from '../repository/reservation.repository';
import { ChannexApiClient } from './channex-api.client';
import { ChannexAriService } from './channex-ari.service';
import {
  CHANNEX_ARI_QUEUE,
  ChannexAriProducer,
} from '../bullmq/channex-ari/channex-ari.producer';
import { ChannexAriProcessor } from '../bullmq/channex-ari/channex-ari.processor';

// Registers the channex-ari queue/processor exactly once. Every module that
// needs to enqueue a push (ChannexModule, ReservationModule,
// ResortFeatureModule, WhatsappModule) imports this module and injects the
// exported ChannexAriProducer, rather than re-registering the queue —
// registering the same BullMQ queue in two modules would mean two
// processors competing as consumers on the same Redis queue.
@Module({
  imports: [
    BullModule.registerQueue({ name: CHANNEX_ARI_QUEUE }),
    TypeOrmModule.forFeature([ResortFeature, Reservation]),
  ],
  providers: [
    ChannexApiClient,
    ResortFeatureRepository,
    ReservationRepository,
    ChannexAriService,
    ChannexAriProducer,
    ChannexAriProcessor,
  ],
  exports: [ChannexAriProducer],
})
export class ChannexAriModule {}
