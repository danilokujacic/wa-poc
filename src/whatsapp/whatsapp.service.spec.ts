import { Test, TestingModule } from '@nestjs/testing';
import { getLoggerToken } from 'nestjs-pino';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WhatsappService } from './whatsapp.service';
import { MessageBatchProducer } from 'src/bullmq/messages/messages.producer';
import { ResortContextService } from 'src/resort/resort-context.service';
import { DESK_EVENTS } from 'src/desk/desk.events';

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
        { provide: ResortContextService, useValue: { get: jest.fn().mockResolvedValue(null) } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
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

  const buildBody = (overrides: { type?: string; text?: string } = {}) => ({
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  id: 'message_id',
                  from: 'guest_number',
                  type: overrides.type ?? 'text',
                  ...(overrides.type === 'image' ? {} : { text: { body: overrides.text ?? 'Hello' } }),
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
  });

  it('should process incoming message correctly', async () => {
    const mockProducer = { addMessage: jest.fn() };
    const mockResortContext = { get: jest.fn().mockResolvedValue(null) };
    const mockEventEmitter = { emit: jest.fn() };
    const mockLogger = { info: jest.fn(), error: jest.fn() };

    const serviceWithMocks = new WhatsappService(mockProducer as any, mockResortContext as any, mockEventEmitter as any, mockLogger as any);

    await serviceWithMocks.processIncoming(buildBody());

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

  it('emits a desk message-received event when the resort resolves', async () => {
    const mockProducer = { addMessage: jest.fn() };
    const resort = { id: 'resort-1' };
    const mockResortContext = { get: jest.fn().mockResolvedValue(resort) };
    const mockEventEmitter = { emit: jest.fn() };
    const mockLogger = { info: jest.fn(), error: jest.fn() };

    const serviceWithMocks = new WhatsappService(mockProducer as any, mockResortContext as any, mockEventEmitter as any, mockLogger as any);

    await serviceWithMocks.processIncoming(buildBody({ text: 'Hi there' }));

    expect(mockEventEmitter.emit).toHaveBeenCalledWith(DESK_EVENTS.MESSAGE_RECEIVED, {
      resortId: 'resort-1',
      guestPhoneNumber: 'guest_number',
      body: 'Hi there',
      sentAt: new Date(1234567890 * 1000).toISOString(),
      traceId: 'message_id',
    });
  });

  it('does not let a desk-recording failure block the rest of processing', async () => {
    const mockProducer = { addMessage: jest.fn() };
    const mockResortContext = { get: jest.fn().mockRejectedValue(new Error('resort lookup failed')) };
    const mockEventEmitter = { emit: jest.fn() };
    const mockLogger = { info: jest.fn(), error: jest.fn() };

    const serviceWithMocks = new WhatsappService(mockProducer as any, mockResortContext as any, mockEventEmitter as any, mockLogger as any);

    await serviceWithMocks.processIncoming(buildBody());

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ traceId: 'message_id' }),
      expect.stringContaining('Error recording inbound message for desk:'),
    );
    expect(mockProducer.addMessage).toHaveBeenCalled();
  });

  it('should handle non-text messages by sending a default response', async () => {
    const mockProducer = { addMessage: jest.fn() };
    const mockResortContext = { get: jest.fn().mockResolvedValue(null) };
    const mockEventEmitter = { emit: jest.fn() };
    const mockLogger = { info: jest.fn(), error: jest.fn() };
    const mockSendText = jest.fn();

    const serviceWithMocks = new WhatsappService(mockProducer as any, mockResortContext as any, mockEventEmitter as any, mockLogger as any);
    serviceWithMocks.sendText = mockSendText;

    await serviceWithMocks.processIncoming(buildBody({ type: 'image' }));

    expect(mockSendText).toHaveBeenCalledWith(
      '1211777188687734',
      '38269280401',
      "Sorry, I can only read text messages for now. How can I help you?",
    );
  });

  it('should handle errors when adding message to queue', async () => {
    const mockProducer = { addMessage: jest.fn().mockRejectedValue(new Error('Queue error')) };
    const mockResortContext = { get: jest.fn().mockResolvedValue(null) };
    const mockEventEmitter = { emit: jest.fn() };
    const mockLogger = { info: jest.fn(), error: jest.fn() };
    const mockSendText = jest.fn();

    const serviceWithMocks = new WhatsappService(mockProducer as any, mockResortContext as any, mockEventEmitter as any, mockLogger as any);
    serviceWithMocks.sendText = mockSendText;

    await serviceWithMocks.processIncoming(buildBody());

    expect(mockSendText).toHaveBeenCalledWith(
      '1211777188687734',
      '38269280401',
      "Sorry, I cannot process your message right now. Please try again later.",
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ traceId: 'message_id', conversationKey: 'phone_number_id:guest_number' }),
      expect.stringContaining('Error adding message to queue:'),
    );
  });

  describe('sendText', () => {
    const mockProducer = { addMessage: jest.fn() };
    const mockResortContext = { get: jest.fn() };
    const mockEventEmitter = { emit: jest.fn() };
    const mockLogger = { info: jest.fn(), error: jest.fn() };

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('throws when the WhatsApp API rejects the send (e.g. an expired/invalid token)', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('{"error":{"message":"Authentication Error","code":190}}'),
      } as Response);

      const serviceWithMocks = new WhatsappService(mockProducer as any, mockResortContext as any, mockEventEmitter as any, mockLogger as any);

      await expect(serviceWithMocks.sendText('phone-id', 'guest-number', 'Hello')).rejects.toThrow('401');
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to send message: 401'));
    });

    it('resolves without throwing when the WhatsApp API accepts the send', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response);

      const serviceWithMocks = new WhatsappService(mockProducer as any, mockResortContext as any, mockEventEmitter as any, mockLogger as any);

      await expect(serviceWithMocks.sendText('phone-id', 'guest-number', 'Hello')).resolves.toBeUndefined();
    });
  });
});
