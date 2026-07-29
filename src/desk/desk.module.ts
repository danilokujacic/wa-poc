import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { RedisModule } from '../redis/redis.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { Conversation } from '../entity/conversation.entity';
import { Message } from '../entity/message.entity';
import { Resort } from '../entity/resort.entity';
import { ConversationRepository } from '../repository/conversation.repository';
import { MessageRepository } from '../repository/message.repository';
import { ResortRepository } from '../repository/resort.repository';
import { ResortMemberGuard } from '../resort/guards/resort-member.guard';
import { DeskThrottlerGuard } from './guards/desk-throttler.guard';
import { DeskGateway } from './desk.gateway';
import { DeskService } from './desk.service';
import { DeskController } from './desk.controller';
import { DESK_MESSAGE_QUEUE, DeskMessageProducer } from '../bullmq/desk-messages/desk-messages.producer';
import { DeskMessageProcessor } from '../bullmq/desk-messages/desk-messages.processor';
import { WA_SEND_QUEUE, WaSendProducer } from '../bullmq/wa-send/wa-send.producer';
import { WaSendProcessor } from '../bullmq/wa-send/wa-send.processor';

@Module({
    imports: [
        TypeOrmModule.forFeature([Conversation, Message, Resort]),
        AuthModule,
        // One-directional now: WaSendProcessor needs MESSAGE_SENDER to actually deliver replies.
        // WhatsappModule needs nothing from DeskModule anymore — see desk.events.ts.
        WhatsappModule,
        RedisModule,
        BullModule.registerQueue({ name: DESK_MESSAGE_QUEUE }, { name: WA_SEND_QUEUE }),
    ],
    providers: [
        DeskGateway,
        DeskService,
        ConversationRepository,
        MessageRepository,
        ResortRepository,
        ResortMemberGuard,
        DeskThrottlerGuard,
        DeskMessageProducer,
        DeskMessageProcessor,
        WaSendProducer,
        WaSendProcessor,
    ],
    controllers: [DeskController],
    exports: [DeskGateway, DeskService],
})
export class DeskModule { }
