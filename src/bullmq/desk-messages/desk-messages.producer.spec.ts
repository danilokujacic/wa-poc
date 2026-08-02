import { DeskMessageProducer } from './desk-messages.producer';
import { MessageSenderType } from '../../entity/message.entity';

const mockQueue = {
  add: jest.fn(),
};

const mockLogger = {
  trace: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
};

describe('DeskMessageProducer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const data = {
    resortId: 'resort-1',
    guestPhoneNumber: '38269280401',
    sender: MessageSenderType.GUEST,
    body: 'Hello',
    sentAt: '2026-01-01T10:00:00.000Z',
  };

  it('enqueues a durable, retrying job', async () => {
    const producer = new DeskMessageProducer(
      mockQueue as any,
      mockLogger as any,
    );
    mockQueue.add.mockResolvedValue({});

    await producer.enqueue(data);

    expect(mockQueue.add).toHaveBeenCalledWith(
      'record',
      data,
      expect.objectContaining({
        attempts: 36,
        backoff: { type: 'fixed', delay: 5 * 60_000 },
        removeOnComplete: true,
        removeOnFail: { age: 24 * 3600 },
      }),
    );
  });

  it('logs and rethrows if enqueueing itself fails', async () => {
    const producer = new DeskMessageProducer(
      mockQueue as any,
      mockLogger as any,
    );
    mockQueue.add.mockRejectedValue(new Error('Redis unavailable'));

    await expect(producer.enqueue(data)).rejects.toThrow('Redis unavailable');
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error enqueuing desk message'),
    );
  });
});
