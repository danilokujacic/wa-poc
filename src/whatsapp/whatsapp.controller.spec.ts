import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getLoggerToken } from 'nestjs-pino';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { MessageBatchProducer } from 'src/bullmq/messages/messages.producer';
import { ResortContextService } from '../resort/resort-context.service';
import { WebhookSignatureGuard } from './guards/webhook-signature.guard';
import { GlobalWebhookThrottlerGuard } from './guards/global-webhook-throttler.guard';

describe('WhatsappController', () => {
  let controller: WhatsappController;

  beforeAll(() => {
    process.env.WHATSAPP_VERIFY_TOKEN = 'test_token';
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WhatsappController],
      providers: [
        WhatsappService,
        { provide: MessageBatchProducer, useValue: { addMessage: jest.fn() } },
        { provide: ResortContextService, useValue: { prewarm: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: getLoggerToken(WhatsappService.name), useValue: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() } },
      ],
    })
      .overrideGuard(WebhookSignatureGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(GlobalWebhookThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<WhatsappController>(WhatsappController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
  it('should return challenge if token is valid', () => {
    const validToken = process.env.WHATSAPP_VERIFY_TOKEN || 'test_token';
    const challenge = 'test_challenge';
    expect(controller.callback(challenge, validToken)).toBe(challenge);
  });

  it('should return null if token is invalid', () => {
    const challenge = 'test_challenge';
    expect(controller.callback(challenge, 'invalid_token')).toBeNull();
  });
  it('should return 200 OK for incoming messages', () => {
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

    const result = controller.handleWebhook(body);
    expect(result).toEqual({ status: 'handled' });
  });
});
