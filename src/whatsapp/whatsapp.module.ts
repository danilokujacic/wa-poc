import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { MESSAGE_SENDER } from 'src/bullmq/messages/message-sender.interface';
import { BullModule } from '@nestjs/bullmq';
import {
  MESSAGE_FLUSH_QUEUE,
  MessageBatchProducer,
} from 'src/bullmq/messages/messages.producer';
import { MessageFlushProcessor } from 'src/bullmq/messages/messages.processor';
import { AiModule } from 'src/ai/ai.module';
import { ResortModule } from 'src/resort/resort.module';
import { ResortFeatureModule } from 'src/resort-feature/resort-feature.module';
import { ReservationModule } from 'src/reservation/reservation.module';
import { RedisModule } from 'src/redis/redis.module';
import { WebhookSignatureGuard } from './guards/webhook-signature.guard';
import { GlobalWebhookThrottlerGuard } from './guards/global-webhook-throttler.guard';
import { Conversation } from 'src/entity/conversation.entity';
import { ConversationRepository } from 'src/repository/conversation.repository';

@Module({
  imports: [
    BullModule.registerQueue({
      name: MESSAGE_FLUSH_QUEUE,
    }),
    TypeOrmModule.forFeature([Conversation]),
    ResortModule,
    ResortFeatureModule,
    ReservationModule,
    AiModule,
    RedisModule,
  ],
  controllers: [WhatsappController],
  providers: [
    WhatsappService,
    { provide: MESSAGE_SENDER, useExisting: WhatsappService },
    MessageBatchProducer,
    MessageFlushProcessor,
    ConversationRepository,
    WebhookSignatureGuard,
    GlobalWebhookThrottlerGuard,
  ],
  exports: [MESSAGE_SENDER],
})
export class WhatsappModule {}
