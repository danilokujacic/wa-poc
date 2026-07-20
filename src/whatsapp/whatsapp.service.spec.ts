import { Test, TestingModule } from '@nestjs/testing';
import { getLoggerToken } from 'nestjs-pino';
import { WhatsappService } from './whatsapp.service';
import { MessageBatchProducer } from 'src/bullmq/messages/messages.producer';

describe('WhatsappService', () => {
  let service: WhatsappService;

  beforeAll(() => {
    process.env.WHATSAPP_VERIFY_TOKEN = 'test_token';
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsappService,
        { provide: MessageBatchProducer, useValue: { addMessage: jest.fn() } },
        { provide: getLoggerToken(WhatsappService.name), useValue: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() } },
      ],
    }).compile();

    service = module.get<WhatsappService>(WhatsappService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
  it('should verify webhook token correctly', () => {
    const validToken = process.env.WHATSAPP_VERIFY_TOKEN || 'test_token';
    expect(service.verifyWebhookToken(validToken)).toBe(true);
    expect(service.verifyWebhookToken('invalid_token')).toBe(false);
  });

  it('should return challenge if token is valid', () => {
    const validToken = process.env.WHATSAPP_VERIFY_TOKEN || 'test_token';
    const challenge = 'test_challenge';
    expect(service.verifyTokenAndReturnChallenge(validToken, challenge)).toBe(challenge);
  });

  it('should return null if token is invalid', () => {
    const challenge = 'test_challenge';
    expect(service.verifyTokenAndReturnChallenge('invalid_token', challenge)).toBeNull();
  });
  it('should process incoming message correctly', async () => {
    const mockProducer = {
      addMessage: jest.fn(),
    };
    const mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
    };

    const serviceWithMocks = new WhatsappService(mockProducer as any, mockLogger as any);

    const body = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    id: 'message_id',
                    from: 'guest_number',
                    type: 'text',
                    text: { body: 'Hello' },
                    timestamp: '1234567890',
                  },
                ],
                contacts: [
                  {
                    profile: { name: 'Guest Name' },
                  },
                ],
                metadata: { phone_number_id: 'phone_number_id' },
              },
            },
          ],
        },
      ],
    };

    await serviceWithMocks.processIncoming(body);

    expect(mockProducer.addMessage).toHaveBeenCalledWith(
      {
        conversationKey: 'phone_number_id:guest_number',
        phoneNumberId: 'phone_number_id',
        guestNumber: 'guest_number',
        guestName: 'Guest Name',
      },
      {
        id: 'message_id',
        text: 'Hello',
        timestamp: 1234567890,
      },
    );
  });
  it('should handle non-text messages by sending a default response', async () => {
    const mockProducer = {
      addMessage: jest.fn(),
    };
    const mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
    };
    const mockSendText = jest.fn();

    const serviceWithMocks = new WhatsappService(mockProducer as any, mockLogger as any);
    serviceWithMocks.sendText = mockSendText;

    const body = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    id: 'message_id',
                    from: 'guest_number',
                    type: 'image', // Non-text message
                    timestamp: '1234567890',
                  },
                ],
                contacts: [
                  {
                    profile: { name: 'Guest Name' },
                  },
                ],
                metadata: { phone_number_id: 'phone_number_id' },
              },
            },
          ],
        },
      ],
    };

    await serviceWithMocks.processIncoming(body);

    expect(mockSendText).toHaveBeenCalledWith(
      '1211777188687734',
      '38269280401',
      "Sorry, I can only read text messages for now. How can I help you?",
    );
  });
  it('should handle errors when adding message to queue', async () => {
    const mockProducer = {
      addMessage: jest.fn().mockRejectedValue(new Error('Queue error')),
    };
    const mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
    };
    const mockSendText = jest.fn();

    const serviceWithMocks = new WhatsappService(mockProducer as any, mockLogger as any);
    serviceWithMocks.sendText = mockSendText;

    const body = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    id: 'message_id',
                    from: 'guest_number',
                    type: 'text',
                    text: { body: 'Hello' },
                    timestamp: '1234567890',
                  },
                ],
                contacts: [
                  {
                    profile: { name: 'Guest Name' },
                  },
                ],
                metadata: { phone_number_id: 'phone_number_id' },
              },
            },
          ],
        },
      ],
    }
      ;
    await serviceWithMocks.processIncoming(body);

    expect(mockSendText).toHaveBeenCalledWith(
      '1211777188687734',
      '38269280401',
      "Sorry, I cannot process your message right now. Please try again later.",
    );
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Error adding message to queue:'));
  });
});
