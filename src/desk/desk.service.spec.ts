import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DeskService } from './desk.service';
import { ConversationRepository } from '../repository/conversation.repository';
import { MessageRepository } from '../repository/message.repository';
import { ResortRepository } from '../repository/resort.repository';
import { DeskGateway } from './desk.gateway';
import { MESSAGE_SENDER } from '../bullmq/messages/message-sender.interface';
import { ConversationStatus } from '../entity/conversation.entity';
import { MessageSenderType } from '../entity/message.entity';

describe('DeskService', () => {
    let service: DeskService;
    let conversationRepository: { findOrCreate: jest.Mock; save: jest.Mock; findOne: jest.Mock; findAllForResort: jest.Mock; findForResort: jest.Mock; isHumanHandled: jest.Mock };
    let messageRepository: { create: jest.Mock; save: jest.Mock; findAllForConversation: jest.Mock };
    let resortRepository: { findOneBy: jest.Mock };
    let deskGateway: { emitNewMessage: jest.Mock };
    let messageSender: { sendText: jest.Mock };

    beforeEach(async () => {
        conversationRepository = {
            findOrCreate: jest.fn(),
            save: jest.fn(async (entity) => entity),
            findOne: jest.fn(),
            findAllForResort: jest.fn(),
            findForResort: jest.fn(),
            isHumanHandled: jest.fn(),
        };
        messageRepository = {
            create: jest.fn((dto) => dto),
            save: jest.fn(async (entity) => ({ id: 'message-1', createdAt: new Date('2026-01-01'), ...entity })),
            findAllForConversation: jest.fn(),
        };
        resortRepository = {
            findOneBy: jest.fn(),
        };
        deskGateway = {
            emitNewMessage: jest.fn(),
        };
        messageSender = {
            sendText: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DeskService,
                { provide: ConversationRepository, useValue: conversationRepository },
                { provide: MessageRepository, useValue: messageRepository },
                { provide: ResortRepository, useValue: resortRepository },
                { provide: DeskGateway, useValue: deskGateway },
                { provide: MESSAGE_SENDER, useValue: messageSender },
            ],
        }).compile();

        service = module.get<DeskService>(DeskService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    it('records a message, finds/creates the conversation, and broadcasts it', async () => {
        const conversation = { id: 'conv-1', status: ConversationStatus.BOT };
        conversationRepository.findOrCreate.mockResolvedValue(conversation);

        const message = await service.recordMessage({
            resortId: 'resort-1',
            guestPhoneNumber: '38269280401',
            sender: MessageSenderType.GUEST,
            body: 'Hello',
        });

        expect(conversationRepository.findOrCreate).toHaveBeenCalledWith('resort-1', '38269280401');
        expect(messageRepository.create).toHaveBeenCalledWith({
            conversation,
            sender: MessageSenderType.GUEST,
            body: 'Hello',
            sentByUser: null,
        });
        expect(deskGateway.emitNewMessage).toHaveBeenCalledWith('resort-1', expect.objectContaining({
            conversationId: 'conv-1',
            sender: MessageSenderType.GUEST,
            body: 'Hello',
        }));
        expect(message.id).toBe('message-1');
    });

    it('reopens a closed conversation when a new guest message arrives', async () => {
        const conversation = { id: 'conv-1', status: ConversationStatus.CLOSED };
        conversationRepository.findOrCreate.mockResolvedValue(conversation);

        await service.recordMessage({
            resortId: 'resort-1',
            guestPhoneNumber: '38269280401',
            sender: MessageSenderType.GUEST,
            body: 'Hello again',
        });

        expect(conversationRepository.save).toHaveBeenCalledWith(
            expect.objectContaining({ status: ConversationStatus.BOT }),
        );
    });

    it('does not reopen a closed conversation for AI/employee messages', async () => {
        const conversation = { id: 'conv-1', status: ConversationStatus.CLOSED };
        conversationRepository.findOrCreate.mockResolvedValue(conversation);

        await service.recordMessage({
            resortId: 'resort-1',
            guestPhoneNumber: '38269280401',
            sender: MessageSenderType.AI,
            body: 'Sorry, this conversation is closed.',
        });

        expect(conversationRepository.save).not.toHaveBeenCalled();
    });

    it('delegates the human-handled check to the repository', async () => {
        conversationRepository.isHumanHandled.mockResolvedValue(true);

        const result = await service.isHumanHandled('resort-1', '38269280401');

        expect(conversationRepository.isHumanHandled).toHaveBeenCalledWith('resort-1', '38269280401');
        expect(result).toBe(true);
    });

    it('handles a desk.message.received event by recording it as a guest message', async () => {
        const recordMessageSpy = jest.spyOn(service, 'recordMessage').mockResolvedValue({ id: 'message-1' } as any);

        await service.handleMessageReceived({ resortId: 'resort-1', guestPhoneNumber: '38269280401', body: 'Hello' });

        expect(recordMessageSpy).toHaveBeenCalledWith({
            resortId: 'resort-1',
            guestPhoneNumber: '38269280401',
            sender: MessageSenderType.GUEST,
            body: 'Hello',
        });
    });

    it('handles a desk.message.ai-replied event by recording it as an AI message', async () => {
        const recordMessageSpy = jest.spyOn(service, 'recordMessage').mockResolvedValue({ id: 'message-1' } as any);

        await service.handleAiReplied({ resortId: 'resort-1', guestPhoneNumber: '38269280401', body: 'How can I help?' });

        expect(recordMessageSpy).toHaveBeenCalledWith({
            resortId: 'resort-1',
            guestPhoneNumber: '38269280401',
            sender: MessageSenderType.AI,
            body: 'How can I help?',
        });
    });

    it('claims a conversation for an employee', async () => {
        conversationRepository.findForResort.mockResolvedValue({ id: 'conv-1', status: ConversationStatus.BOT });

        const result = await service.claim('resort-1', 'conv-1', 'user-1');

        expect(result.status).toBe(ConversationStatus.HUMAN);
        expect(result.assignedUser).toEqual({ id: 'user-1' });
    });

    it('throws when claiming a conversation that does not belong to the resort', async () => {
        conversationRepository.findForResort.mockResolvedValue(null);

        await expect(service.claim('resort-1', 'conv-1', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('closes a conversation', async () => {
        conversationRepository.findForResort.mockResolvedValue({ id: 'conv-1', status: ConversationStatus.HUMAN });

        const result = await service.close('resort-1', 'conv-1');

        expect(result.status).toBe(ConversationStatus.CLOSED);
    });

    it('sends and records an employee reply', async () => {
        conversationRepository.findForResort.mockResolvedValue({ id: 'conv-1', guestPhoneNumber: '38269280401', status: ConversationStatus.HUMAN });
        conversationRepository.findOrCreate.mockResolvedValue({ id: 'conv-1', status: ConversationStatus.HUMAN });
        resortRepository.findOneBy.mockResolvedValue({ id: 'resort-1', phoneNumber: '1211777188687734' });

        await service.replyAsEmployee('resort-1', 'conv-1', 'user-1', 'On it!');

        expect(messageSender.sendText).toHaveBeenCalledWith('1211777188687734', '38269280401', 'On it!');
        expect(messageRepository.create).toHaveBeenCalledWith(
            expect.objectContaining({ sender: MessageSenderType.EMPLOYEE, body: 'On it!', sentByUser: { id: 'user-1' } }),
        );
    });

    it('throws when replying for a resort that no longer exists', async () => {
        conversationRepository.findForResort.mockResolvedValue({ id: 'conv-1', guestPhoneNumber: '38269280401' });
        resortRepository.findOneBy.mockResolvedValue(null);

        await expect(service.replyAsEmployee('resort-1', 'conv-1', 'user-1', 'Hi')).rejects.toThrow(NotFoundException);
        expect(messageSender.sendText).not.toHaveBeenCalled();
    });

    it('lists conversations for a resort', async () => {
        const conversations = [{ id: 'conv-1' }];
        conversationRepository.findAllForResort.mockResolvedValue(conversations);

        const result = await service.findAllConversations('resort-1');

        expect(result).toBe(conversations);
    });

    it('lists messages for a conversation that belongs to the resort', async () => {
        conversationRepository.findForResort.mockResolvedValue({ id: 'conv-1' });
        const messages = [{ id: 'message-1' }];
        messageRepository.findAllForConversation.mockResolvedValue(messages);

        const result = await service.findMessages('resort-1', 'conv-1');

        expect(result).toBe(messages);
    });

    it('throws when getting messages for a conversation that does not belong to the resort', async () => {
        conversationRepository.findForResort.mockResolvedValue(null);

        await expect(service.findMessages('resort-1', 'conv-1')).rejects.toThrow(NotFoundException);
    });
});
