import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { DeskController } from './desk.controller';
import { DeskService } from './desk.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ResortMemberGuard } from '../resort/guards/resort-member.guard';
import { DeskThrottlerGuard } from './guards/desk-throttler.guard';
import { ConversationStatus } from '../entity/conversation.entity';
import { MessageSenderType } from '../entity/message.entity';
import type { JwtPayload } from '../auth/jwt-payload.interface';

describe('DeskController', () => {
  let controller: DeskController;
  let service: {
    findAllConversations: jest.Mock;
    findMessages: jest.Mock;
    claim: jest.Mock;
    close: jest.Mock;
    replyAsEmployee: jest.Mock;
    retryMessageDelivery: jest.Mock;
  };

  const conversation = {
    id: 'conv-1',
    guestPhoneNumber: '38269280401',
    status: ConversationStatus.BOT,
    assignedUser: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const message = {
    id: 'message-1',
    conversation: { id: 'conv-1' },
    sender: MessageSenderType.GUEST,
    body: 'Hello',
    sentByUser: null,
    createdAt: new Date(),
  };
  const request = {
    user: {
      sub: 'user-1',
      email: 'a@b.com',
      role: 'Employee',
      resortId: 'resort-1',
    },
  } as unknown as Request & { user: JwtPayload };

  beforeEach(async () => {
    service = {
      findAllConversations: jest.fn(),
      findMessages: jest.fn(),
      claim: jest.fn(),
      close: jest.fn(),
      replyAsEmployee: jest.fn(),
      retryMessageDelivery: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeskController],
      providers: [{ provide: DeskService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ResortMemberGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(DeskThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DeskController>(DeskController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates findAllConversations to the service', async () => {
    service.findAllConversations.mockResolvedValue([conversation]);

    await controller.findAllConversations('resort-1');

    expect(service.findAllConversations).toHaveBeenCalledWith('resort-1');
  });

  it('delegates findMessages to the service', async () => {
    service.findMessages.mockResolvedValue([message]);

    await controller.findMessages('resort-1', 'conv-1');

    expect(service.findMessages).toHaveBeenCalledWith('resort-1', 'conv-1');
  });

  it('delegates claim to the service using the authenticated user id', async () => {
    service.claim.mockResolvedValue({
      ...conversation,
      status: ConversationStatus.HUMAN,
    });

    await controller.claim('resort-1', 'conv-1', request);

    expect(service.claim).toHaveBeenCalledWith('resort-1', 'conv-1', 'user-1');
  });

  it('delegates close to the service', async () => {
    service.close.mockResolvedValue({
      ...conversation,
      status: ConversationStatus.CLOSED,
    });

    await controller.close('resort-1', 'conv-1');

    expect(service.close).toHaveBeenCalledWith('resort-1', 'conv-1');
  });

  it('delegates reply to the service using the authenticated user id', async () => {
    service.replyAsEmployee.mockResolvedValue({
      ...message,
      sender: MessageSenderType.EMPLOYEE,
      sentByUser: { id: 'user-1' },
    });

    await controller.reply(
      'resort-1',
      'conv-1',
      { body: 'On it!' },
      request,
      undefined,
    );

    expect(service.replyAsEmployee).toHaveBeenCalledWith(
      'resort-1',
      'conv-1',
      'user-1',
      'On it!',
      undefined,
    );
  });

  it('passes the Idempotency-Key header through to the service', async () => {
    service.replyAsEmployee.mockResolvedValue({
      ...message,
      sender: MessageSenderType.EMPLOYEE,
      sentByUser: { id: 'user-1' },
    });

    await controller.reply(
      'resort-1',
      'conv-1',
      { body: 'On it!' },
      request,
      'key-123',
    );

    expect(service.replyAsEmployee).toHaveBeenCalledWith(
      'resort-1',
      'conv-1',
      'user-1',
      'On it!',
      'key-123',
    );
  });

  it('rejects an Idempotency-Key header that is too long', async () => {
    const tooLong = 'a'.repeat(201);

    await expect(
      controller.reply(
        'resort-1',
        'conv-1',
        { body: 'On it!' },
        request,
        tooLong,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(service.replyAsEmployee).not.toHaveBeenCalled();
  });

  it('delegates retryMessage to the service', async () => {
    service.retryMessageDelivery.mockResolvedValue({
      ...message,
      sender: MessageSenderType.EMPLOYEE,
    });

    await controller.retryMessage('resort-1', 'conv-1', 'message-1');

    expect(service.retryMessageDelivery).toHaveBeenCalledWith(
      'resort-1',
      'conv-1',
      'message-1',
    );
  });
});
