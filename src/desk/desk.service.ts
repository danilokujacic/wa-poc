import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConversationRepository } from '../repository/conversation.repository';
import { MessageRepository } from '../repository/message.repository';
import { ResortRepository } from '../repository/resort.repository';
import { Conversation, ConversationStatus } from '../entity/conversation.entity';
import { Message, MessageSenderType } from '../entity/message.entity';
import { DeskGateway } from './desk.gateway';
import { DESK_EVENTS } from './desk.events';
import type { AiRepliedEvent, MessageReceivedEvent } from './desk.events';
import { MESSAGE_SENDER } from '../bullmq/messages/message-sender.interface';
import type { MessageSender } from '../bullmq/messages/message-sender.interface';

export interface RecordMessageParams {
    resortId: string;
    guestPhoneNumber: string;
    sender: MessageSenderType;
    body: string;
    sentByUserId?: string;
}

@Injectable()
export class DeskService {
    constructor(
        private readonly conversationRepository: ConversationRepository,
        private readonly messageRepository: MessageRepository,
        private readonly resortRepository: ResortRepository,
        private readonly deskGateway: DeskGateway,
        @Inject(MESSAGE_SENDER) private readonly messageSender: MessageSender,
    ) { }

    async recordMessage(params: RecordMessageParams): Promise<Message> {
        let conversation = await this.conversationRepository.findOrCreate(params.resortId, params.guestPhoneNumber);

        if (params.sender === MessageSenderType.GUEST && conversation.status === ConversationStatus.CLOSED) {
            conversation.status = ConversationStatus.BOT;
            conversation = await this.conversationRepository.save(conversation);
        }

        const message = await this.messageRepository.save(
            this.messageRepository.create({
                conversation,
                sender: params.sender,
                body: params.body,
                sentByUser: params.sentByUserId ? ({ id: params.sentByUserId } as Message['sentByUser']) : null,
            }),
        );

        this.deskGateway.emitNewMessage(params.resortId, {
            conversationId: conversation.id,
            messageId: message.id,
            sender: message.sender,
            body: message.body,
            createdAt: message.createdAt,
            conversationStatus: conversation.status,
        });

        return message;
    }

    isHumanHandled(resortId: string, guestPhoneNumber: string): Promise<boolean> {
        return this.conversationRepository.isHumanHandled(resortId, guestPhoneNumber);
    }

    @OnEvent(DESK_EVENTS.MESSAGE_RECEIVED)
    handleMessageReceived(event: MessageReceivedEvent): Promise<Message> {
        return this.recordMessage({
            resortId: event.resortId,
            guestPhoneNumber: event.guestPhoneNumber,
            sender: MessageSenderType.GUEST,
            body: event.body,
        });
    }

    @OnEvent(DESK_EVENTS.AI_REPLIED)
    handleAiReplied(event: AiRepliedEvent): Promise<Message> {
        return this.recordMessage({
            resortId: event.resortId,
            guestPhoneNumber: event.guestPhoneNumber,
            sender: MessageSenderType.AI,
            body: event.body,
        });
    }

    async claim(resortId: string, conversationId: string, userId: string): Promise<Conversation> {
        const conversation = await this.findConversationOrThrow(resortId, conversationId);
        conversation.status = ConversationStatus.HUMAN;
        conversation.assignedUser = { id: userId } as Conversation['assignedUser'];
        return this.conversationRepository.save(conversation);
    }

    async close(resortId: string, conversationId: string): Promise<Conversation> {
        const conversation = await this.findConversationOrThrow(resortId, conversationId);
        conversation.status = ConversationStatus.CLOSED;
        return this.conversationRepository.save(conversation);
    }

    async replyAsEmployee(resortId: string, conversationId: string, userId: string, body: string): Promise<Message> {
        const conversation = await this.findConversationOrThrow(resortId, conversationId);

        const resort = await this.resortRepository.findOneBy({ id: resortId });
        if (!resort) {
            throw new NotFoundException(`Resort with id ${resortId} not found`);
        }

        await this.messageSender.sendText(resort.phoneNumber, conversation.guestPhoneNumber, body);

        return this.recordMessage({
            resortId,
            guestPhoneNumber: conversation.guestPhoneNumber,
            sender: MessageSenderType.EMPLOYEE,
            body,
            sentByUserId: userId,
        });
    }

    findAllConversations(resortId: string): Promise<Conversation[]> {
        return this.conversationRepository.findAllForResort(resortId);
    }

    async findMessages(resortId: string, conversationId: string): Promise<Message[]> {
        await this.findConversationOrThrow(resortId, conversationId);
        return this.messageRepository.findAllForConversation(conversationId);
    }

    private async findConversationOrThrow(resortId: string, conversationId: string): Promise<Conversation> {
        const conversation = await this.conversationRepository.findForResort(resortId, conversationId);
        if (!conversation) {
            throw new NotFoundException(`Conversation with id ${conversationId} not found for resort ${resortId}`);
        }
        return conversation;
    }
}
