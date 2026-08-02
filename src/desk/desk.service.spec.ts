import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getLoggerToken } from 'nestjs-pino';
import { DeskService } from './desk.service';
import { ConversationRepository } from '../repository/conversation.repository';
import { MessageRepository } from '../repository/message.repository';
import { ResortRepository } from '../repository/resort.repository';
import { DeskGateway } from './desk.gateway';
import { REDIS_CLIENT } from '../redis/redis.provider';
import { DeskMessageProducer } from '../bullmq/desk-messages/desk-messages.producer';
import { WaSendProducer } from '../bullmq/wa-send/wa-send.producer';
import { ConversationStatus } from '../entity/conversation.entity';
import {
  MessageDeliveryStatus,
  MessageSenderType,
} from '../entity/message.entity';

describe('DeskService', () => {
  let service: DeskService;
  let conversationRepository: {
    findOrCreate: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    findAllForResort: jest.Mock;
    findForResort: jest.Mock;
    isHumanHandled: jest.Mock;
    updateLastMessageSentAt: jest.Mock;
  };
  let messageRepository: {
    create: jest.Mock;
    save: jest.Mock;
    findAllForConversation: jest.Mock;
    findOneForConversation: jest.Mock;
    update: jest.Mock;
  };
  let resortRepository: { findOneBy: jest.Mock };
  let deskGateway: {
    emitNewMessage: jest.Mock;
    emitMessageStatusUpdated: jest.Mock;
  };
  let redis: { get: jest.Mock; set: jest.Mock; del: jest.Mock };
  let logger: {
    info: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
    debug: jest.Mock;
  };
  let deskMessageProducer: { enqueue: jest.Mock };
  let waSendProducer: { enqueue: jest.Mock };

  beforeEach(async () => {
    conversationRepository = {
      findOrCreate: jest.fn(),
      save: jest.fn(async (entity) => entity),
      findOne: jest.fn(),
      findAllForResort: jest.fn(),
      findForResort: jest.fn(),
      isHumanHandled: jest.fn(),
      updateLastMessageSentAt: jest.fn().mockResolvedValue(undefined),
    };
    messageRepository = {
      create: jest.fn((dto) => dto),
      save: jest.fn(async (entity) => ({
        id: 'message-1',
        createdAt: new Date('2026-01-01'),
        ...entity,
      })),
      findAllForConversation: jest.fn(),
      findOneForConversation: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    resortRepository = {
      findOneBy: jest.fn(),
    };
    deskGateway = {
      emitNewMessage: jest.fn(),
      emitMessageStatusUpdated: jest.fn(),
    };
    redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn(),
      del: jest.fn(),
    };
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    deskMessageProducer = {
      enqueue: jest.fn().mockResolvedValue(undefined),
    };
    waSendProducer = {
      enqueue: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeskService,
        { provide: ConversationRepository, useValue: conversationRepository },
        { provide: MessageRepository, useValue: messageRepository },
        { provide: ResortRepository, useValue: resortRepository },
        { provide: DeskGateway, useValue: deskGateway },
        { provide: REDIS_CLIENT, useValue: redis },
        { provide: getLoggerToken(DeskService.name), useValue: logger },
        { provide: DeskMessageProducer, useValue: deskMessageProducer },
        { provide: WaSendProducer, useValue: waSendProducer },
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

    const sentAt = '2026-01-01T10:00:00.000Z';
    const message = await service.recordMessage({
      resortId: 'resort-1',
      guestPhoneNumber: '38269280401',
      sender: MessageSenderType.GUEST,
      body: 'Hello',
      sentAt,
    });

    expect(conversationRepository.findOrCreate).toHaveBeenCalledWith(
      'resort-1',
      '38269280401',
    );
    expect(messageRepository.create).toHaveBeenCalledWith({
      conversation,
      sender: MessageSenderType.GUEST,
      body: 'Hello',
      sentAt: new Date(sentAt),
      deliveryStatus: null,
      sentByUser: null,
    });
    expect(deskGateway.emitNewMessage).toHaveBeenCalledWith(
      'resort-1',
      expect.objectContaining({
        conversationId: 'conv-1',
        sender: MessageSenderType.GUEST,
        body: 'Hello',
        deliveryStatus: null,
      }),
    );
    expect(message.id).toBe('message-1');
    // Guests never need a WhatsApp delivery — nothing to send back to ourselves.
    expect(waSendProducer.enqueue).not.toHaveBeenCalled();
  });

  it('marks AI/employee messages "Pending" and enqueues them for durable delivery when a phoneNumberId is given', async () => {
    const conversation = { id: 'conv-1', status: ConversationStatus.BOT };
    conversationRepository.findOrCreate.mockResolvedValue(conversation);

    const message = await service.recordMessage({
      resortId: 'resort-1',
      guestPhoneNumber: '38269280401',
      sender: MessageSenderType.AI,
      body: 'How can I help?',
      sentAt: '2026-01-01T10:00:00.000Z',
      phoneNumberId: 'phone-id-1',
    });

    expect(messageRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryStatus: MessageDeliveryStatus.PENDING,
      }),
    );
    expect(waSendProducer.enqueue).toHaveBeenCalledWith({
      messageId: message.id,
      resortId: 'resort-1',
      conversationId: 'conv-1',
      phoneNumberId: 'phone-id-1',
      guestPhoneNumber: '38269280401',
      text: 'How can I help?',
      traceId: message.id,
    });
  });

  it('does not fail the whole recordMessage call if enqueueing the WhatsApp send fails', async () => {
    const conversation = { id: 'conv-1', status: ConversationStatus.BOT };
    conversationRepository.findOrCreate.mockResolvedValue(conversation);
    waSendProducer.enqueue.mockRejectedValue(new Error('Redis unavailable'));

    const message = await service.recordMessage({
      resortId: 'resort-1',
      guestPhoneNumber: '38269280401',
      sender: MessageSenderType.AI,
      body: 'How can I help?',
      sentAt: '2026-01-01T10:00:00.000Z',
      phoneNumberId: 'phone-id-1',
    });

    expect(message.id).toBe('message-1');
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ traceId: 'message-1', messageId: 'message-1' }),
      expect.stringContaining('Failed to enqueue WhatsApp delivery'),
    );
  });

  it('reopens a closed conversation when a new guest message arrives', async () => {
    const conversation = { id: 'conv-1', status: ConversationStatus.CLOSED };
    conversationRepository.findOrCreate.mockResolvedValue(conversation);

    await service.recordMessage({
      resortId: 'resort-1',
      guestPhoneNumber: '38269280401',
      sender: MessageSenderType.GUEST,
      body: 'Hello again',
      sentAt: '2026-01-01T10:00:00.000Z',
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
      sentAt: '2026-01-01T10:00:00.000Z',
    });

    expect(conversationRepository.save).not.toHaveBeenCalled();
  });

  it('delegates the human-handled check to the repository', async () => {
    conversationRepository.isHumanHandled.mockResolvedValue(true);

    const result = await service.isHumanHandled('resort-1', '38269280401');

    expect(conversationRepository.isHumanHandled).toHaveBeenCalledWith(
      'resort-1',
      '38269280401',
    );
    expect(result).toBe(true);
  });

  it('handles a desk.message.received event by enqueuing it as a guest message', async () => {
    await service.handleMessageReceived({
      resortId: 'resort-1',
      guestPhoneNumber: '38269280401',
      body: 'Hello',
      sentAt: '2026-01-01T10:00:00.000Z',
      traceId: 'wamid.123',
    });

    expect(deskMessageProducer.enqueue).toHaveBeenCalledWith({
      resortId: 'resort-1',
      guestPhoneNumber: '38269280401',
      sender: MessageSenderType.GUEST,
      body: 'Hello',
      sentAt: '2026-01-01T10:00:00.000Z',
      traceId: 'wamid.123',
    });
  });

  it('handles a desk.message.ai-replied event by enqueuing it as an AI message', async () => {
    await service.handleAiReplied({
      resortId: 'resort-1',
      guestPhoneNumber: '38269280401',
      body: 'How can I help?',
      sentAt: '2026-01-01T10:00:00.000Z',
      phoneNumberId: 'phone-id-1',
      traceId: 'trace-1',
    });

    expect(deskMessageProducer.enqueue).toHaveBeenCalledWith({
      resortId: 'resort-1',
      guestPhoneNumber: '38269280401',
      sender: MessageSenderType.AI,
      body: 'How can I help?',
      sentAt: '2026-01-01T10:00:00.000Z',
      phoneNumberId: 'phone-id-1',
      traceId: 'trace-1',
    });
  });

  it('claims a conversation for an employee', async () => {
    conversationRepository.findForResort.mockResolvedValue({
      id: 'conv-1',
      status: ConversationStatus.BOT,
    });

    const result = await service.claim('resort-1', 'conv-1', 'user-1');

    expect(result.status).toBe(ConversationStatus.HUMAN);
    expect(result.assignedUser).toEqual({ id: 'user-1' });
  });

  it('throws when claiming a conversation that does not belong to the resort', async () => {
    conversationRepository.findForResort.mockResolvedValue(null);

    await expect(service.claim('resort-1', 'conv-1', 'user-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('closes a conversation', async () => {
    conversationRepository.findForResort.mockResolvedValue({
      id: 'conv-1',
      status: ConversationStatus.HUMAN,
    });

    const result = await service.close('resort-1', 'conv-1');

    expect(result.status).toBe(ConversationStatus.CLOSED);
  });

  it('records an employee reply as "Pending" and durably enqueues its WhatsApp delivery', async () => {
    conversationRepository.findForResort.mockResolvedValue({
      id: 'conv-1',
      guestPhoneNumber: '38269280401',
      status: ConversationStatus.HUMAN,
    });
    conversationRepository.findOrCreate.mockResolvedValue({
      id: 'conv-1',
      status: ConversationStatus.HUMAN,
    });
    resortRepository.findOneBy.mockResolvedValue({
      id: 'resort-1',
      phoneNumber: '1211777188687734',
    });

    const message = await service.replyAsEmployee(
      'resort-1',
      'conv-1',
      'user-1',
      'On it!',
    );

    expect(messageRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        sender: MessageSenderType.EMPLOYEE,
        body: 'On it!',
        sentByUser: { id: 'user-1' },
        deliveryStatus: MessageDeliveryStatus.PENDING,
      }),
    );
    expect(waSendProducer.enqueue).toHaveBeenCalledWith({
      messageId: message.id,
      resortId: 'resort-1',
      conversationId: 'conv-1',
      phoneNumberId: '1211777188687734',
      guestPhoneNumber: '38269280401',
      text: 'On it!',
      traceId: expect.any(String),
    });
  });

  it('throws when replying for a resort that no longer exists', async () => {
    conversationRepository.findForResort.mockResolvedValue({
      id: 'conv-1',
      guestPhoneNumber: '38269280401',
    });
    resortRepository.findOneBy.mockResolvedValue(null);

    await expect(
      service.replyAsEmployee('resort-1', 'conv-1', 'user-1', 'Hi'),
    ).rejects.toThrow(NotFoundException);
    expect(waSendProducer.enqueue).not.toHaveBeenCalled();
  });

  it('still records and returns the employee reply even if enqueueing the WhatsApp delivery fails', async () => {
    conversationRepository.findForResort.mockResolvedValue({
      id: 'conv-1',
      guestPhoneNumber: '38269280401',
      status: ConversationStatus.HUMAN,
    });
    conversationRepository.findOrCreate.mockResolvedValue({
      id: 'conv-1',
      status: ConversationStatus.HUMAN,
    });
    resortRepository.findOneBy.mockResolvedValue({
      id: 'resort-1',
      phoneNumber: '1211777188687734',
    });
    waSendProducer.enqueue.mockRejectedValue(new Error('Redis unavailable'));

    const message = await service.replyAsEmployee(
      'resort-1',
      'conv-1',
      'user-1',
      'On it!',
    );

    expect(message.id).toBe('message-1');
  });

  describe('replyAsEmployee idempotency key', () => {
    beforeEach(() => {
      conversationRepository.findForResort.mockResolvedValue({
        id: 'conv-1',
        guestPhoneNumber: '38269280401',
        status: ConversationStatus.HUMAN,
      });
      conversationRepository.findOrCreate.mockResolvedValue({
        id: 'conv-1',
        status: ConversationStatus.HUMAN,
      });
      resortRepository.findOneBy.mockResolvedValue({
        id: 'resort-1',
        phoneNumber: '1211777188687734',
      });
    });

    it('claims the key via SET NX and records the reply as normal on first use', async () => {
      redis.set.mockResolvedValue('OK');

      const message = await service.replyAsEmployee(
        'resort-1',
        'conv-1',
        'user-1',
        'On it!',
        'key-1',
      );

      expect(redis.set).toHaveBeenCalledWith(
        'desk:idempotency:conv-1:key-1',
        'pending',
        'EX',
        24 * 3600,
        'NX',
      );
      expect(redis.set).toHaveBeenCalledWith(
        'desk:idempotency:conv-1:key-1',
        message.id,
        'EX',
        24 * 3600,
      );
      expect(messageRepository.save).toHaveBeenCalled();
    });

    it('returns the original message instead of creating a duplicate when the key was already used', async () => {
      redis.set.mockResolvedValue(null); // NX fails: key already claimed
      redis.get.mockResolvedValue('existing-message-id');
      messageRepository.findOneForConversation.mockResolvedValue({
        id: 'existing-message-id',
        body: 'On it!',
      });

      const message = await service.replyAsEmployee(
        'resort-1',
        'conv-1',
        'user-1',
        'On it!',
        'key-1',
      );

      expect(message.id).toBe('existing-message-id');
      expect(messageRepository.save).not.toHaveBeenCalled();
      expect(waSendProducer.enqueue).not.toHaveBeenCalled();
    });

    it('rejects with a conflict if the key is claimed but still mid-flight (no message recorded yet)', async () => {
      redis.set.mockResolvedValue(null);
      redis.get.mockResolvedValue('pending');

      await expect(
        service.replyAsEmployee(
          'resort-1',
          'conv-1',
          'user-1',
          'On it!',
          'key-1',
        ),
      ).rejects.toThrow(ConflictException);
      expect(messageRepository.save).not.toHaveBeenCalled();
    });

    it('releases the claim if recording the message throws, so a genuine retry is not blocked for the full TTL', async () => {
      redis.set.mockResolvedValue('OK');
      messageRepository.save.mockRejectedValue(new Error('DB unavailable'));

      await expect(
        service.replyAsEmployee(
          'resort-1',
          'conv-1',
          'user-1',
          'On it!',
          'key-1',
        ),
      ).rejects.toThrow('DB unavailable');

      expect(redis.del).toHaveBeenCalledWith('desk:idempotency:conv-1:key-1');
    });

    it('does not touch Redis idempotency keys at all when no key is provided', async () => {
      await service.replyAsEmployee('resort-1', 'conv-1', 'user-1', 'On it!');

      expect(redis.set).not.toHaveBeenCalledWith(
        expect.stringContaining('desk:idempotency:'),
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });
  });

  describe('retryMessageDelivery', () => {
    const conversation = { id: 'conv-1', guestPhoneNumber: '38269280401' };
    const failedMessage = {
      id: 'message-1',
      sender: MessageSenderType.EMPLOYEE,
      body: 'On it!',
      sentAt: new Date('2026-01-01T10:00:00.000Z'),
      deliveryStatus: MessageDeliveryStatus.FAILED,
      conversation,
    };

    it('re-enqueues a failed message unchanged and flips it back to Pending', async () => {
      conversationRepository.findForResort.mockResolvedValue(conversation);
      messageRepository.findOneForConversation.mockResolvedValue({
        ...failedMessage,
      });
      resortRepository.findOneBy.mockResolvedValue({
        id: 'resort-1',
        phoneNumber: '1211777188687734',
      });

      const result = await service.retryMessageDelivery(
        'resort-1',
        'conv-1',
        'message-1',
      );

      expect(waSendProducer.enqueue).toHaveBeenCalledWith({
        messageId: 'message-1',
        resortId: 'resort-1',
        conversationId: 'conv-1',
        phoneNumberId: '1211777188687734',
        guestPhoneNumber: '38269280401',
        text: 'On it!',
        traceId: 'message-1',
      });
      expect(messageRepository.update).toHaveBeenCalledWith(
        { id: 'message-1', deliveryStatus: MessageDeliveryStatus.FAILED },
        { deliveryStatus: MessageDeliveryStatus.PENDING },
      );
      expect(deskGateway.emitMessageStatusUpdated).toHaveBeenCalledWith(
        'resort-1',
        {
          conversationId: 'conv-1',
          messageId: 'message-1',
          deliveryStatus: MessageDeliveryStatus.PENDING,
        },
      );
      expect(result.deliveryStatus).toBe(MessageDeliveryStatus.PENDING);
      // The retry must reuse the exact same body/sentAt — it's the same message, not a new one.
      expect(result.sentAt).toEqual(failedMessage.sentAt);
    });

    it('throws when the message does not exist in that conversation', async () => {
      conversationRepository.findForResort.mockResolvedValue(conversation);
      messageRepository.findOneForConversation.mockResolvedValue(null);

      await expect(
        service.retryMessageDelivery('resort-1', 'conv-1', 'missing'),
      ).rejects.toThrow(NotFoundException);
      expect(waSendProducer.enqueue).not.toHaveBeenCalled();
    });

    it('rejects retrying a guest message', async () => {
      conversationRepository.findForResort.mockResolvedValue(conversation);
      messageRepository.findOneForConversation.mockResolvedValue({
        ...failedMessage,
        sender: MessageSenderType.GUEST,
      });

      await expect(
        service.retryMessageDelivery('resort-1', 'conv-1', 'message-1'),
      ).rejects.toThrow(BadRequestException);
      expect(waSendProducer.enqueue).not.toHaveBeenCalled();
    });

    it('rejects retrying a message that is not Failed, to avoid double-sending', async () => {
      conversationRepository.findForResort.mockResolvedValue(conversation);
      messageRepository.findOneForConversation.mockResolvedValue({
        ...failedMessage,
        deliveryStatus: MessageDeliveryStatus.PENDING,
      });

      await expect(
        service.retryMessageDelivery('resort-1', 'conv-1', 'message-1'),
      ).rejects.toThrow(BadRequestException);
      expect(waSendProducer.enqueue).not.toHaveBeenCalled();
    });

    it('rejects a concurrent retry that loses the atomic Failed -> Pending claim, even though its own read saw Failed', async () => {
      conversationRepository.findForResort.mockResolvedValue(conversation);
      messageRepository.findOneForConversation.mockResolvedValue({
        ...failedMessage,
      });
      resortRepository.findOneBy.mockResolvedValue({
        id: 'resort-1',
        phoneNumber: '1211777188687734',
      });
      // Simulates another concurrent retry call having already flipped the row first.
      messageRepository.update.mockResolvedValueOnce({ affected: 0 });

      await expect(
        service.retryMessageDelivery('resort-1', 'conv-1', 'message-1'),
      ).rejects.toThrow(BadRequestException);
      expect(waSendProducer.enqueue).not.toHaveBeenCalled();
    });

    it('reverts the claim back to Failed if enqueueing the retry itself fails, instead of leaving it stuck Pending', async () => {
      conversationRepository.findForResort.mockResolvedValue(conversation);
      messageRepository.findOneForConversation.mockResolvedValue({
        ...failedMessage,
      });
      resortRepository.findOneBy.mockResolvedValue({
        id: 'resort-1',
        phoneNumber: '1211777188687734',
      });
      waSendProducer.enqueue.mockRejectedValue(new Error('Redis unavailable'));

      await expect(
        service.retryMessageDelivery('resort-1', 'conv-1', 'message-1'),
      ).rejects.toThrow('Redis unavailable');

      expect(messageRepository.update).toHaveBeenNthCalledWith(
        1,
        { id: 'message-1', deliveryStatus: MessageDeliveryStatus.FAILED },
        { deliveryStatus: MessageDeliveryStatus.PENDING },
      );
      expect(messageRepository.update).toHaveBeenNthCalledWith(2, 'message-1', {
        deliveryStatus: MessageDeliveryStatus.FAILED,
      });
      expect(deskGateway.emitMessageStatusUpdated).toHaveBeenNthCalledWith(
        1,
        'resort-1',
        {
          conversationId: 'conv-1',
          messageId: 'message-1',
          deliveryStatus: MessageDeliveryStatus.PENDING,
        },
      );
      expect(deskGateway.emitMessageStatusUpdated).toHaveBeenNthCalledWith(
        2,
        'resort-1',
        {
          conversationId: 'conv-1',
          messageId: 'message-1',
          deliveryStatus: MessageDeliveryStatus.FAILED,
        },
      );
    });
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

    await expect(service.findMessages('resort-1', 'conv-1')).rejects.toThrow(
      NotFoundException,
    );
  });
});
