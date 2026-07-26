import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { Conversation } from '../entity/conversation.entity';
import { Message } from '../entity/message.entity';
import { Resort } from '../entity/resort.entity';
import { ConversationRepository } from '../repository/conversation.repository';
import { MessageRepository } from '../repository/message.repository';
import { ResortRepository } from '../repository/resort.repository';
import { ResortMemberGuard } from '../resort/guards/resort-member.guard';
import { DeskGateway } from './desk.gateway';
import { DeskService } from './desk.service';
import { DeskController } from './desk.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([Conversation, Message, Resort]),
        AuthModule,
        // One-directional now: DeskService needs MESSAGE_SENDER to send employee replies.
        // WhatsappModule needs nothing from DeskModule anymore — see desk.events.ts.
        WhatsappModule,
    ],
    providers: [DeskGateway, DeskService, ConversationRepository, MessageRepository, ResortRepository, ResortMemberGuard],
    controllers: [DeskController],
    exports: [DeskGateway, DeskService],
})
export class DeskModule { }
