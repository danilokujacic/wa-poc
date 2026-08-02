import { Test } from '@nestjs/testing';
import { MessageBatchProducer } from './messages.producer';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

const mockQueue = {
  getJob: jest.fn(),
  add: jest.fn(),
};

const mockMulti = {
  lrange: jest.fn().mockReturnThis(),
  del: jest.fn().mockReturnThis(),
  exec: jest.fn(),
};

const mockRedis = {
  set: jest.fn(),
  rpush: jest.fn(),
  expire: jest.fn(),
  lrange: jest.fn(),
  del: jest.fn(),
  llen: jest.fn(),
  multi: jest.fn(() => mockMulti),
};

const mockResortContextService = {
  warm: jest.fn().mockResolvedValue(undefined),
};

const mockLogger = {
  trace: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
};

describe('MessagesProducer', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    Test.createTestingModule({
      providers: [
        MessageBatchProducer,
        {
          provide: Queue,
          useValue: mockQueue,
        },
        {
          provide: Redis,
          useValue: mockRedis,
        },
      ],
    });
  });

  it('should add a message and schedule a flush job', async () => {
    const producer = new MessageBatchProducer(
      mockQueue as any,
      mockRedis as any,
      mockResortContextService as any,
      mockLogger as any,
    );
    const data = {
      conversationKey: '123:456',
      phoneNumberId: '123',
      guestNumber: '456',
      guestName: 'John Doe',
    };
    const message = {
      id: 'msg1',
      text: 'Hello',
      timestamp: Date.now(),
    };

    mockRedis.set.mockResolvedValue('OK');
    mockRedis.llen.mockResolvedValue(1);
    mockQueue.getJob.mockResolvedValue(null);
    mockQueue.add.mockResolvedValue({});

    await producer.addMessage(data, message);

    expect(mockRedis.set).toHaveBeenCalledWith(
      `wa:seen:${message.id}`,
      '1',
      'EX',
      3600,
      'NX',
    );
    expect(mockRedis.rpush).toHaveBeenCalledWith(
      `wa:buffer:${data.conversationKey}`,
      JSON.stringify(message),
    );
    expect(mockRedis.expire).toHaveBeenCalledWith(
      `wa:buffer:${data.conversationKey}`,
      3600,
    );
    expect(mockQueue.add).toHaveBeenCalledWith(
      'flush',
      data,
      expect.objectContaining({
        jobId: `flush:${data.conversationKey}`,
        delay: 6000,
        removeOnComplete: true,
        removeOnFail: 50,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      }),
    );
  });
  it('should not add a duplicate message', async () => {
    const producer = new MessageBatchProducer(
      mockQueue as any,
      mockRedis as any,
      mockResortContextService as any,
      mockLogger as any,
    );
    const data = {
      conversationKey: '123:456',
      phoneNumberId: '123',
      guestNumber: '456',
      guestName: 'John Doe',
    };
    const message = {
      id: 'msg1',
      text: 'Hello',
      timestamp: Date.now(),
    };

    mockRedis.set.mockResolvedValue(null); // Simulate duplicate

    await producer.addMessage(data, message);

    expect(mockRedis.set).toHaveBeenCalledWith(
      `wa:seen:${message.id}`,
      '1',
      'EX',
      3600,
      'NX',
    );
    expect(mockRedis.rpush).not.toHaveBeenCalled();
    expect(mockQueue.add).not.toHaveBeenCalled();
  });
  it('should reschedule an existing flush job', async () => {
    const producer = new MessageBatchProducer(
      mockQueue as any,
      mockRedis as any,
      mockResortContextService as any,
      mockLogger as any,
    );
    const data = {
      conversationKey: '123:456',
      phoneNumberId: '123',
      guestNumber: '456',
      guestName: 'John Doe',
    };
    const message = {
      id: 'msg1',
      text: 'Hello',
      timestamp: Date.now(),
    };

    mockRedis.set.mockResolvedValue('OK');
    mockRedis.llen.mockResolvedValue(1);
    const mockExistingJob = {
      getState: jest.fn().mockResolvedValue('delayed'),
      remove: jest.fn(),
    };
    mockQueue.getJob.mockResolvedValue(mockExistingJob);

    await producer.addMessage(data, message);

    expect(mockExistingJob.remove).toHaveBeenCalled();
    expect(mockQueue.add).toHaveBeenCalledWith(
      'flush',
      data,
      expect.objectContaining({
        jobId: `flush:${data.conversationKey}`,
        delay: 6000,
        removeOnComplete: true,
        removeOnFail: 50,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      }),
    );
  });
  it('should handle queue.add failure and retry with a new jobId', async () => {
    const producer = new MessageBatchProducer(
      mockQueue as any,
      mockRedis as any,
      mockResortContextService as any,
      mockLogger as any,
    );
    const data = {
      conversationKey: '123:456',
      phoneNumberId: '123',
      guestNumber: '456',
      guestName: 'John Doe',
    };
    const message = {
      id: 'msg1',
      text: 'Hello',
      timestamp: Date.now(),
    };

    mockRedis.set.mockResolvedValue('OK');
    mockRedis.llen.mockResolvedValue(1);
    mockQueue.getJob.mockResolvedValue(null);
    mockQueue.add
      .mockRejectedValueOnce(new Error('Queue add failed'))
      .mockResolvedValue({});

    await producer.addMessage(data, message);

    expect(mockQueue.add).toHaveBeenCalledTimes(2);
  });

  it('should drain and flush messages correctly', async () => {
    const producer = new MessageBatchProducer(
      mockQueue as any,
      mockRedis as any,
      mockResortContextService as any,
      mockLogger as any,
    );
    const conversationKey = '123:456';
    const listKey = `wa:buffer:${conversationKey}`;
    const messages = [
      { id: 'msg1', text: 'Hello', timestamp: Date.now() },
      { id: 'msg2', text: 'How are you?', timestamp: Date.now() },
    ];

    mockMulti.exec.mockResolvedValue([
      [null, messages.map((m) => JSON.stringify(m))],
      [null, 1],
    ]);

    const drainedMessages = await producer.drain(conversationKey);

    expect(mockMulti.lrange).toHaveBeenCalledWith(listKey, 0, -1);
    expect(mockMulti.del).toHaveBeenCalledWith(listKey);
    expect(drainedMessages).toEqual(messages);
  });
  it('should return empty array if no messages to drain', async () => {
    const producer = new MessageBatchProducer(
      mockQueue as any,
      mockRedis as any,
      mockResortContextService as any,
      mockLogger as any,
    );
    const conversationKey = '123:456';
    const listKey = `wa:buffer:${conversationKey}`;

    mockMulti.exec.mockResolvedValue([
      [null, []],
      [null, 0],
    ]);

    const drainedMessages = await producer.drain(conversationKey);

    expect(mockMulti.lrange).toHaveBeenCalledWith(listKey, 0, -1);
    expect(mockMulti.del).toHaveBeenCalledWith(listKey);
    expect(drainedMessages).toEqual([]);
  });
  it('should handle errors during drain gracefully', async () => {
    const producer = new MessageBatchProducer(
      mockQueue as any,
      mockRedis as any,
      mockResortContextService as any,
      mockLogger as any,
    );
    const conversationKey = '123:456';
    const listKey = `wa:buffer:${conversationKey}`;

    mockMulti.exec.mockRejectedValue(new Error('Redis error'));

    const drainedMessages = await producer.drain(conversationKey);

    expect(mockMulti.lrange).toHaveBeenCalledWith(listKey, 0, -1);
    expect(mockMulti.del).toHaveBeenCalledWith(listKey);
    expect(drainedMessages).toEqual([]);
  });
});
