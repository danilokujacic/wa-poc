import type { Job } from 'bullmq';
import { UnrecoverableError } from 'bullmq';
import { WaSendProcessor } from './wa-send.processor';
import { MessageDeliveryStatus } from '../../entity/message.entity';
import { WhatsappSendError } from '../messages/message-sender.interface';
import type { WaSendJobData } from './wa-send.producer';

type MockWaSendJob = Job<WaSendJobData>;

const mockLogger = {
  trace: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
};

describe('WaSendProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const job = {
    data: {
      messageId: 'message-1',
      resortId: 'resort-1',
      conversationId: 'conv-1',
      phoneNumberId: 'phone-id-1',
      guestPhoneNumber: '38269280401',
      text: 'On it!',
      traceId: 'message-1',
    },
    attemptsMade: 0,
  } as unknown as MockWaSendJob;

  it('sends via WhatsApp, marks the message Sent, and broadcasts the status update', async () => {
    const mockSendText = jest.fn().mockResolvedValue(undefined);
    const mockUpdate = jest.fn();
    const mockEmit = jest.fn();
    const processor = new WaSendProcessor(
      { sendText: mockSendText },
      { update: mockUpdate } as any,
      { emitMessageStatusUpdated: mockEmit } as any,
      mockLogger as any,
    );

    await processor.process(job);

    expect(mockSendText).toHaveBeenCalledWith(
      'phone-id-1',
      '38269280401',
      'On it!',
    );
    expect(mockUpdate).toHaveBeenCalledWith('message-1', {
      deliveryStatus: MessageDeliveryStatus.SENT,
    });
    expect(mockEmit).toHaveBeenCalledWith('resort-1', {
      conversationId: 'conv-1',
      messageId: 'message-1',
      deliveryStatus: MessageDeliveryStatus.SENT,
    });
  });

  it('lets a transient (5xx) failure propagate as-is so BullMQ retries', async () => {
    const mockSendText = jest
      .fn()
      .mockRejectedValue(new WhatsappSendError(503, 'Service Unavailable'));
    const processor = new WaSendProcessor(
      { sendText: mockSendText },
      { update: jest.fn() } as any,
      { emitMessageStatusUpdated: jest.fn() } as any,
      mockLogger as any,
    );

    const error = (await processor
      .process(job)
      .catch((e: unknown) => e)) as Error;
    expect(error.message).toContain('Service Unavailable');
    expect(error).not.toBeInstanceOf(UnrecoverableError);
  });

  it('lets a rate-limit (429) failure propagate as-is so BullMQ retries', async () => {
    const mockSendText = jest
      .fn()
      .mockRejectedValue(new WhatsappSendError(429, 'Too Many Requests'));
    const processor = new WaSendProcessor(
      { sendText: mockSendText },
      { update: jest.fn() } as any,
      { emitMessageStatusUpdated: jest.fn() } as any,
      mockLogger as any,
    );

    const error = (await processor
      .process(job)
      .catch((e: unknown) => e)) as Error;
    expect(error).not.toBeInstanceOf(UnrecoverableError);
  });

  it('lets a non-WhatsappSendError (e.g. a network error) propagate as-is so BullMQ retries', async () => {
    const mockSendText = jest.fn().mockRejectedValue(new Error('fetch failed'));
    const processor = new WaSendProcessor(
      { sendText: mockSendText },
      { update: jest.fn() } as any,
      { emitMessageStatusUpdated: jest.fn() } as any,
      mockLogger as any,
    );

    const error = (await processor
      .process(job)
      .catch((e: unknown) => e)) as Error;
    expect(error.message).toContain('fetch failed');
    expect(error).not.toBeInstanceOf(UnrecoverableError);
  });

  it('fails fast (no retry) on a permanent failure like a bad/expired token', async () => {
    const mockSendText = jest
      .fn()
      .mockRejectedValue(new WhatsappSendError(401, 'Authentication Error'));
    const processor = new WaSendProcessor(
      { sendText: mockSendText },
      { update: jest.fn() } as any,
      { emitMessageStatusUpdated: jest.fn() } as any,
      mockLogger as any,
    );

    await expect(processor.process(job)).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
  });

  it('marks the message Failed and broadcasts once retries are exhausted', async () => {
    const mockUpdate = jest.fn();
    const mockEmit = jest.fn();
    const processor = new WaSendProcessor(
      { sendText: jest.fn() },
      { update: mockUpdate } as any,
      { emitMessageStatusUpdated: mockEmit } as any,
      mockLogger as any,
    );
    const failedJob = {
      ...job,
      attemptsMade: 3,
      opts: { attempts: 3 },
    } as unknown as MockWaSendJob;

    await processor.onFailed(
      failedJob,
      new WhatsappSendError(503, 'Service Unavailable'),
    );

    expect(mockUpdate).toHaveBeenCalledWith('message-1', {
      deliveryStatus: MessageDeliveryStatus.FAILED,
    });
    expect(mockEmit).toHaveBeenCalledWith('resort-1', {
      conversationId: 'conv-1',
      messageId: 'message-1',
      deliveryStatus: MessageDeliveryStatus.FAILED,
    });
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ traceId: 'message-1', messageId: 'message-1' }),
      expect.stringContaining('permanently failed'),
    );
  });

  it('marks the message Failed immediately on an UnrecoverableError, even on the first attempt', async () => {
    const mockUpdate = jest.fn();
    const mockEmit = jest.fn();
    const processor = new WaSendProcessor(
      { sendText: jest.fn() },
      { update: mockUpdate } as any,
      { emitMessageStatusUpdated: mockEmit } as any,
      mockLogger as any,
    );
    // Only 1 of the configured 3 attempts happened — UnrecoverableError short-circuits the rest.
    const failFastJob = {
      ...job,
      attemptsMade: 1,
      opts: { attempts: 3 },
    } as unknown as MockWaSendJob;

    await processor.onFailed(
      failFastJob,
      new UnrecoverableError('Authentication Error'),
    );

    expect(mockUpdate).toHaveBeenCalledWith('message-1', {
      deliveryStatus: MessageDeliveryStatus.FAILED,
    });
    expect(mockEmit).toHaveBeenCalledWith('resort-1', {
      conversationId: 'conv-1',
      messageId: 'message-1',
      deliveryStatus: MessageDeliveryStatus.FAILED,
    });
  });

  it('does not mark the message Failed while retries remain', async () => {
    const mockUpdate = jest.fn();
    const processor = new WaSendProcessor(
      { sendText: jest.fn() },
      { update: mockUpdate } as any,
      { emitMessageStatusUpdated: jest.fn() } as any,
      mockLogger as any,
    );
    const retryingJob = {
      ...job,
      attemptsMade: 1,
      opts: { attempts: 3 },
    } as unknown as MockWaSendJob;

    await processor.onFailed(
      retryingJob,
      new WhatsappSendError(503, 'Service Unavailable'),
    );

    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
