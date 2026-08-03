import type { Job } from 'bullmq';
import type { FlushJobData } from './messages.producer';
import { MessageFlushProcessor } from './messages.processor';
import { AiService } from 'src/ai/ai.service';
import { ReservationStatus } from 'src/entity/reservation.entity';
import { DESK_EVENTS } from 'src/desk/desk.events';

type MockFlushJob = Job<FlushJobData>;

function mockRedis(
  overrides: Partial<
    Record<
      'get' | 'incr' | 'expire' | 'set' | 'del' | 'lrange' | 'rpush' | 'ltrim',
      jest.Mock
    >
  > = {},
) {
  return {
    get: jest.fn().mockResolvedValue(null),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    lrange: jest.fn().mockResolvedValue([]),
    rpush: jest.fn().mockResolvedValue(1),
    ltrim: jest.fn().mockResolvedValue('OK'),
    ...overrides,
  };
}

function mockLogger() {
  return {
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
  };
}

describe('MessageProcessor', () => {
  const job = {
    data: {
      conversationKey: '123:456',
      phoneNumberId: '123',
      guestNumber: '456',
      guestName: 'John Doe',
    },
  } as unknown as MockFlushJob;

  it('should return early if there are no messages to flush', async () => {
    const processor = new MessageFlushProcessor(
      { drain: jest.fn().mockResolvedValue([]) } as any,
      new AiService(null as any, mockLogger() as any),
      { get: jest.fn() } as any,
      { find: jest.fn() } as any,
      {
        findLatestPendingForGuest: jest.fn(),
        countActiveForFeature: jest.fn(),
      } as any,
      { isHumanHandled: jest.fn().mockResolvedValue(false) } as any,
      { emit: jest.fn() } as any,
      { sendText: jest.fn() },
      mockRedis() as any,
      mockLogger() as any,
    );

    await processor.process(job);

    // eslint-disable-next-line @typescript-eslint/unbound-method -- jest.fn() mock, no `this` usage
    expect(processor['producer'].drain).toHaveBeenCalledWith('123:456');
  });
  it('should process messages and send a reply', async () => {
    const mockDrain = jest.fn().mockResolvedValue([
      { id: 'msg1', text: 'Hello', timestamp: 1234567890 },
      { id: 'msg2', text: 'How are you?', timestamp: 1234567891 },
    ]);

    const mockGenerateReply = jest
      .fn()
      .mockResolvedValue('I am fine, thank you!');

    const mockSendText = jest.fn();

    const processor = new MessageFlushProcessor(
      { drain: mockDrain } as any,
      { generateReply: mockGenerateReply } as any,
      { get: jest.fn().mockResolvedValue(null) } as any,
      { find: jest.fn() } as any,
      {
        findLatestPendingForGuest: jest.fn(),
        countActiveForFeature: jest.fn(),
      } as any,
      { isHumanHandled: jest.fn().mockResolvedValue(false) } as any,
      { emit: jest.fn() } as any,
      { sendText: mockSendText },
      mockRedis() as any,
      mockLogger() as any,
    );

    await processor.process(job);

    expect(mockDrain).toHaveBeenCalledWith('123:456');
    expect(mockGenerateReply).toHaveBeenCalledWith(
      'John Doe',
      expect.any(String),
    );
    expect(mockSendText).toHaveBeenCalledWith(
      '123',
      '456',
      'I am fine, thank you!',
    );
  });
  it('emits a desk AI-replied event once it resolves a resort', async () => {
    const mockDrain = jest
      .fn()
      .mockResolvedValue([
        { id: 'msg1', text: 'Hello', timestamp: 1234567890 },
      ]);
    const mockGenerateReply = jest
      .fn()
      .mockResolvedValue('I am fine, thank you!');
    const mockSendText = jest.fn();
    const mockEmit = jest.fn();
    const resort = { id: 'resort-1' };

    const processor = new MessageFlushProcessor(
      { drain: mockDrain } as any,
      { generateReply: mockGenerateReply } as any,
      { get: jest.fn().mockResolvedValue(resort) } as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
      {
        findLatestPendingForGuest: jest.fn().mockResolvedValue(null),
        countActiveForFeature: jest.fn().mockResolvedValue(0),
      } as any,
      { isHumanHandled: jest.fn().mockResolvedValue(false) } as any,
      { emit: mockEmit } as any,
      { sendText: mockSendText },
      mockRedis() as any,
      mockLogger() as any,
    );

    await processor.process(job);

    // With a resort resolved, delivery happens durably via the desk pipeline instead of a
    // direct send here — see WA_SEND_QUEUE.
    expect(mockSendText).not.toHaveBeenCalled();
    // expect.any() is typed `any` by @types/jest, hence the disables below.
    /* eslint-disable @typescript-eslint/no-unsafe-assignment */
    expect(mockEmit).toHaveBeenCalledWith(DESK_EVENTS.AI_REPLIED, {
      resortId: 'resort-1',
      guestPhoneNumber: '456',
      body: 'I am fine, thank you!',
      sentAt: expect.any(String),
      phoneNumberId: '123',
      traceId: expect.any(String),
    });
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */
  });
  it('skips AI generation entirely once an employee has taken over the conversation', async () => {
    const mockDrain = jest
      .fn()
      .mockResolvedValue([
        { id: 'msg1', text: 'Hello', timestamp: 1234567890 },
      ]);
    const mockGenerateReply = jest.fn();
    const mockSendText = jest.fn();
    const resort = { id: 'resort-1' };

    const processor = new MessageFlushProcessor(
      { drain: mockDrain } as any,
      { generateReply: mockGenerateReply } as any,
      { get: jest.fn().mockResolvedValue(resort) } as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
      {
        findLatestPendingForGuest: jest.fn().mockResolvedValue(null),
        countActiveForFeature: jest.fn().mockResolvedValue(0),
      } as any,
      { isHumanHandled: jest.fn().mockResolvedValue(true) } as any,
      { emit: jest.fn() } as any,
      { sendText: mockSendText },
      mockRedis() as any,
      mockLogger() as any,
    );

    await processor.process(job);

    expect(mockGenerateReply).not.toHaveBeenCalled();
    expect(mockSendText).not.toHaveBeenCalled();
  });
  it('replies gracefully instead of throwing when the AI service fails', async () => {
    const mockDrain = jest
      .fn()
      .mockResolvedValue([
        { id: 'msg1', text: 'Hello', timestamp: 1234567890 },
      ]);

    const mockGenerateReply = jest
      .fn()
      .mockRejectedValue(new Error('AI service error'));

    const mockSendText = jest.fn();
    const redis = mockRedis();

    const processor = new MessageFlushProcessor(
      { drain: mockDrain } as any,
      { generateReply: mockGenerateReply } as any,
      { get: jest.fn().mockResolvedValue(null) } as any,
      { find: jest.fn() } as any,
      {
        findLatestPendingForGuest: jest.fn(),
        countActiveForFeature: jest.fn(),
      } as any,
      { isHumanHandled: jest.fn().mockResolvedValue(false) } as any,
      { emit: jest.fn() } as any,
      { sendText: mockSendText },
      redis as any,
      mockLogger() as any,
    );

    await expect(processor.process(job)).resolves.toBeUndefined();

    expect(mockDrain).toHaveBeenCalledWith('123:456');
    expect(mockGenerateReply).toHaveBeenCalledWith(
      'John Doe',
      expect.any(String),
    );
    expect(mockSendText).toHaveBeenCalledWith(
      '123',
      '456',
      "We're experiencing high demand right now and couldn't process your message. Please try again in a few minutes.",
    );
    // A failed AI turn shouldn't burn the guest's session budget.
    expect(redis.incr).not.toHaveBeenCalled();
  });
  it('should build prompt correctly with resort FAQs', async () => {
    const mockDrain = jest
      .fn()
      .mockResolvedValue([
        { id: 'msg1', text: 'Hello', timestamp: 1234567890 },
      ]);

    const mockGenerateReply = jest
      .fn()
      .mockResolvedValue('I am fine, thank you!');

    const mockSendText = jest.fn();

    const resort = {
      id: 'resort-1',
      name: 'Sunset Bay',
      faqs: [{ question: 'Q?', answer: 'A.' }],
      contacts: [],
    };

    const processor = new MessageFlushProcessor(
      { drain: mockDrain } as any,
      { generateReply: mockGenerateReply } as any,
      { get: jest.fn().mockResolvedValue(resort) } as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
      {
        findLatestPendingForGuest: jest.fn().mockResolvedValue(null),
        countActiveForFeature: jest.fn(),
      } as any,
      { isHumanHandled: jest.fn().mockResolvedValue(false) } as any,
      { emit: jest.fn() } as any,
      { sendText: mockSendText },
      mockRedis() as any,
      mockLogger() as any,
    );

    await processor.process(job);

    expect(mockDrain).toHaveBeenCalledWith('123:456');
    expect(mockGenerateReply).toHaveBeenCalledWith(
      'John Doe',
      expect.stringContaining('Q: Q?\nA: A.'),
    );
    // With a resort resolved, delivery happens durably via the desk pipeline instead of a
    // direct send here — see WA_SEND_QUEUE.
    expect(mockSendText).not.toHaveBeenCalled();
  });
  it('should build prompt correctly without resort FAQs', async () => {
    const mockDrain = jest
      .fn()
      .mockResolvedValue([
        { id: 'msg1', text: 'Hello', timestamp: 1234567890 },
      ]);

    const mockGenerateReply = jest
      .fn()
      .mockResolvedValue('I am fine, thank you!');

    const mockSendText = jest.fn();

    const processor = new MessageFlushProcessor(
      { drain: mockDrain } as any,
      { generateReply: mockGenerateReply } as any,
      { get: jest.fn().mockResolvedValue(null) } as any,
      { find: jest.fn() } as any,
      {
        findLatestPendingForGuest: jest.fn(),
        countActiveForFeature: jest.fn(),
      } as any,
      { isHumanHandled: jest.fn().mockResolvedValue(false) } as any,
      { emit: jest.fn() } as any,
      { sendText: mockSendText },
      mockRedis() as any,
      mockLogger() as any,
    );

    await processor.process(job);

    expect(mockDrain).toHaveBeenCalledWith('123:456');
    expect(mockGenerateReply).toHaveBeenCalledWith(
      'John Doe',
      expect.any(String),
    );
    expect(mockSendText).toHaveBeenCalledWith(
      '123',
      '456',
      'I am fine, thank you!',
    );
  });
  it('should handle errors when generating AI reply', async () => {
    const mockDrain = jest
      .fn()
      .mockResolvedValue([
        { id: 'msg1', text: 'Hello', timestamp: 1234567890 },
      ]);

    const mockGenerateReply = jest
      .fn()
      .mockRejectedValue(new Error('AI service error'));

    const mockSendText = jest.fn();

    const processor = new MessageFlushProcessor(
      { drain: mockDrain } as any,
      { generateReply: mockGenerateReply } as any,
      { get: jest.fn().mockResolvedValue(null) } as any,
      { find: jest.fn() } as any,
      {
        findLatestPendingForGuest: jest.fn(),
        countActiveForFeature: jest.fn(),
      } as any,
      { isHumanHandled: jest.fn().mockResolvedValue(false) } as any,
      { emit: jest.fn() } as any,
      { sendText: mockSendText },
      mockRedis() as any,
      mockLogger() as any,
    );

    await expect(processor.process(job)).resolves.toBeUndefined();

    expect(mockDrain).toHaveBeenCalledWith('123:456');
    expect(mockGenerateReply).toHaveBeenCalledWith(
      'John Doe',
      expect.any(String),
    );
    expect(mockSendText).toHaveBeenCalledWith(
      '123',
      '456',
      "We're experiencing high demand right now and couldn't process your message. Please try again in a few minutes.",
    );
  });
  it('should handle errors when fetching resort context', async () => {
    const mockDrain = jest
      .fn()
      .mockResolvedValue([
        { id: 'msg1', text: 'Hello', timestamp: 1234567890 },
      ]);

    const mockGenerateReply = jest
      .fn()
      .mockResolvedValue('I am fine, thank you!');

    const mockSendText = jest.fn();

    const processor = new MessageFlushProcessor(
      { drain: mockDrain } as any,
      { generateReply: mockGenerateReply } as any,
      {
        get: jest.fn().mockRejectedValue(new Error('Resort context error')),
      } as any,
      { find: jest.fn() } as any,
      {
        findLatestPendingForGuest: jest.fn(),
        countActiveForFeature: jest.fn(),
      } as any,
      { isHumanHandled: jest.fn().mockResolvedValue(false) } as any,
      { emit: jest.fn() } as any,
      { sendText: mockSendText },
      mockRedis() as any,
      mockLogger() as any,
    );

    await expect(processor.process(job)).resolves.toBeUndefined();

    expect(mockDrain).toHaveBeenCalledWith('123:456');
    expect(mockGenerateReply).not.toHaveBeenCalled();
    expect(mockSendText).toHaveBeenCalledWith(
      '123',
      '456',
      "We're experiencing high demand right now and couldn't process your message. Please try again in a few minutes.",
    );
  });
  it('should handle errors when fetching resort features', async () => {
    const mockDrain = jest
      .fn()
      .mockResolvedValue([
        { id: 'msg1', text: 'Hello', timestamp: 1234567890 },
      ]);

    const mockGenerateReply = jest
      .fn()
      .mockResolvedValue('I am fine, thank you!');

    const mockSendText = jest.fn();

    const processor = new MessageFlushProcessor(
      { drain: mockDrain } as any,
      { generateReply: mockGenerateReply } as any,
      {
        get: jest.fn().mockResolvedValue({
          id: 'resort-1',
          name: 'Sunset Bay',
          faqs: [],
          contacts: [],
        }),
      } as any,
      {
        find: jest.fn().mockRejectedValue(new Error('Resort features error')),
      } as any,
      {
        findLatestPendingForGuest: jest.fn(),
        countActiveForFeature: jest.fn(),
      } as any,
      { isHumanHandled: jest.fn().mockResolvedValue(false) } as any,
      { emit: jest.fn() } as any,
      { sendText: mockSendText },
      mockRedis() as any,
      mockLogger() as any,
    );

    await expect(processor.process(job)).resolves.toBeUndefined();

    expect(mockDrain).toHaveBeenCalledWith('123:456');
    expect(mockGenerateReply).not.toHaveBeenCalled();
    expect(mockSendText).toHaveBeenCalledWith(
      '123',
      '456',
      "We're experiencing high demand right now and couldn't process your message. Please try again in a few minutes.",
    );
  });

  it('should handle errors when sending text', async () => {
    const mockDrain = jest
      .fn()
      .mockResolvedValue([
        { id: 'msg1', text: 'Hello', timestamp: 1234567890 },
      ]);

    const mockGenerateReply = jest
      .fn()
      .mockResolvedValue('I am fine, thank you!');

    const mockSendText = jest
      .fn()
      .mockRejectedValue(new Error('Send text error'));

    const processor = new MessageFlushProcessor(
      { drain: mockDrain } as any,
      { generateReply: mockGenerateReply } as any,
      { get: jest.fn().mockResolvedValue(null) } as any,
      { find: jest.fn() } as any,
      {
        findLatestPendingForGuest: jest.fn(),
        countActiveForFeature: jest.fn(),
      } as any,
      { isHumanHandled: jest.fn().mockResolvedValue(false) } as any,
      { emit: jest.fn() } as any,
      { sendText: mockSendText },
      mockRedis() as any,
      mockLogger() as any,
    );

    await expect(processor.process(job)).rejects.toThrow('Send text error');

    expect(mockDrain).toHaveBeenCalledWith('123:456');
    expect(mockGenerateReply).toHaveBeenCalledWith(
      'John Doe',
      expect.any(String),
    );
    expect(mockSendText).toHaveBeenCalledWith(
      '123',
      '456',
      'I am fine, thank you!',
    );
  });

  it('does not fetch features when there is no resort for the conversation', async () => {
    const mockDrain = jest
      .fn()
      .mockResolvedValue([
        { id: 'msg1', text: 'Hello there', timestamp: 1234567890 },
      ]);
    const mockFind = jest.fn().mockResolvedValue([]);

    const processor = new MessageFlushProcessor(
      { drain: mockDrain } as any,
      { generateReply: jest.fn().mockResolvedValue('Hi!') } as any,
      { get: jest.fn().mockResolvedValue(null) } as any,
      { find: mockFind } as any,
      {
        findLatestPendingForGuest: jest.fn().mockResolvedValue(null),
        countActiveForFeature: jest.fn(),
      } as any,
      { isHumanHandled: jest.fn().mockResolvedValue(false) } as any,
      { emit: jest.fn() } as any,
      { sendText: jest.fn() },
      mockRedis() as any,
      mockLogger() as any,
    );

    await processor.process(job);

    expect(mockFind).not.toHaveBeenCalled();
  });

  it('fetches features and availability for every guest message, regardless of language', async () => {
    const mockDrain = jest
      .fn()
      .mockResolvedValue([
        { id: 'msg1', text: 'Koliko košta Cabana?', timestamp: 1234567890 },
      ]);
    const feature = {
      id: 'feature-1',
      name: 'Cabana',
      price: 49.99,
      quantity: 5,
    };
    const mockFind = jest.fn().mockResolvedValue([feature]);
    const mockCountActive = jest.fn().mockResolvedValue(2);
    const mockGenerateReply = jest
      .fn()
      .mockResolvedValue('It costs $49.99, 3 left!');

    const processor = new MessageFlushProcessor(
      { drain: mockDrain } as any,
      { generateReply: mockGenerateReply } as any,
      {
        get: jest.fn().mockResolvedValue({
          id: 'resort-1',
          name: 'Sunset Bay',
          faqs: [],
          contacts: [],
        }),
      } as any,
      { find: mockFind } as any,
      {
        findLatestPendingForGuest: jest.fn().mockResolvedValue(null),
        countActiveForFeature: mockCountActive,
      } as any,
      { isHumanHandled: jest.fn().mockResolvedValue(false) } as any,
      { emit: jest.fn() } as any,
      { sendText: jest.fn() },
      mockRedis() as any,
      mockLogger() as any,
    );

    await processor.process(job);

    expect(mockFind).toHaveBeenCalledWith({
      where: { resort: { id: 'resort-1' }, isActive: true },
    });
    expect(mockCountActive).toHaveBeenCalledWith('feature-1');
    expect(mockGenerateReply).toHaveBeenCalledWith(
      'John Doe',
      expect.stringContaining('available 3/5'),
    );
  });

  it('replays prior conversation history into the prompt so the AI has memory across debounce cycles', async () => {
    const mockDrain = jest
      .fn()
      .mockResolvedValue([
        { id: 'msg1', text: '2 adults and 2 kids', timestamp: 1234567890 },
      ]);
    const mockGenerateReply = jest
      .fn()
      .mockResolvedValue('Great, and what dates would you like?');
    const redis = mockRedis({
      lrange: jest.fn().mockResolvedValue([
        JSON.stringify({
          role: 'guest',
          text: 'I want to book the Private Cabana',
        }),
        JSON.stringify({
          role: 'assistant',
          text: 'Sure, what dates would you like?',
        }),
        JSON.stringify({ role: 'guest', text: '5 - 18 august' }),
        JSON.stringify({
          role: 'assistant',
          text: 'How many adults and kids will be staying?',
        }),
      ]),
    });

    const processor = new MessageFlushProcessor(
      { drain: mockDrain } as any,
      { generateReply: mockGenerateReply } as any,
      {
        get: jest.fn().mockResolvedValue({
          id: 'resort-1',
          name: 'Sunset Bay',
          faqs: [],
          contacts: [],
        }),
      } as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
      {
        findLatestPendingForGuest: jest.fn().mockResolvedValue(null),
        countActiveForFeature: jest.fn(),
      } as any,
      { isHumanHandled: jest.fn().mockResolvedValue(false) } as any,
      { emit: jest.fn() } as any,
      { sendText: jest.fn() },
      redis as any,
      mockLogger() as any,
    );

    await processor.process(job);

    expect(redis.lrange).toHaveBeenCalledWith('wa:history:123:456', 0, -1);
    expect(mockGenerateReply).toHaveBeenCalledWith(
      'John Doe',
      expect.stringContaining('Guest: I want to book the Private Cabana'),
    );
    expect(mockGenerateReply).toHaveBeenCalledWith(
      'John Doe',
      expect.stringContaining(
        'Assistant: How many adults and kids will be staying?',
      ),
    );
  });

  it('appends the guest message and AI reply to conversation history after a successful turn', async () => {
    const mockDrain = jest.fn().mockResolvedValue([
      {
        id: 'msg1',
        text: 'What are your working hours?',
        timestamp: 1234567890,
      },
    ]);
    const mockGenerateReply = jest
      .fn()
      .mockResolvedValue('We are open 9am to 9pm.');
    const redis = mockRedis();

    const processor = new MessageFlushProcessor(
      { drain: mockDrain } as any,
      { generateReply: mockGenerateReply } as any,
      {
        get: jest.fn().mockResolvedValue({
          id: 'resort-1',
          name: 'Sunset Bay',
          faqs: [],
          contacts: [],
        }),
      } as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
      {
        findLatestPendingForGuest: jest.fn().mockResolvedValue(null),
        countActiveForFeature: jest.fn(),
      } as any,
      { isHumanHandled: jest.fn().mockResolvedValue(false) } as any,
      { emit: jest.fn() } as any,
      { sendText: jest.fn() },
      redis as any,
      mockLogger() as any,
    );

    await processor.process(job);

    expect(redis.rpush).toHaveBeenNthCalledWith(
      1,
      'wa:history:123:456',
      JSON.stringify({ role: 'guest', text: 'What are your working hours?' }),
    );
    expect(redis.rpush).toHaveBeenNthCalledWith(
      2,
      'wa:history:123:456',
      JSON.stringify({ role: 'assistant', text: 'We are open 9am to 9pm.' }),
    );
    expect(redis.ltrim).toHaveBeenCalledWith('wa:history:123:456', -20, -1);
    expect(redis.expire).toHaveBeenCalledWith('wa:history:123:456', 24 * 3600);
  });

  it('does not append to history when the conversation is human-handled (no reply was actually produced)', async () => {
    const mockDrain = jest
      .fn()
      .mockResolvedValue([
        { id: 'msg1', text: 'Hello?', timestamp: 1234567890 },
      ]);
    const redis = mockRedis();

    const processor = new MessageFlushProcessor(
      { drain: mockDrain } as any,
      { generateReply: jest.fn() } as any,
      {
        get: jest.fn().mockResolvedValue({
          id: 'resort-1',
          name: 'Sunset Bay',
          faqs: [],
          contacts: [],
        }),
      } as any,
      { find: jest.fn() } as any,
      {
        findLatestPendingForGuest: jest.fn(),
        countActiveForFeature: jest.fn(),
      } as any,
      { isHumanHandled: jest.fn().mockResolvedValue(true) } as any,
      { emit: jest.fn() } as any,
      { sendText: jest.fn() },
      redis as any,
      mockLogger() as any,
    );

    await processor.process(job);

    expect(redis.rpush).not.toHaveBeenCalled();
  });

  it('creates a pending reservation when the AI reply includes the reservation marker', async () => {
    const mockDrain = jest.fn().mockResolvedValue([
      {
        id: 'msg1',
        text: 'I want to book the Cabana',
        timestamp: 1234567890,
      },
    ]);
    const feature = {
      id: 'feature-1',
      name: 'Cabana',
      price: 49.99,
      quantity: 5,
    };
    const mockSendText = jest.fn();
    const mockSave = jest.fn((entity: object) => entity);
    const mockCreate = jest.fn((dto: object) => dto);
    const mockGenerateReply = jest
      .fn()
      .mockResolvedValue(
        'Name: John Doe\nGuests: 3\nAdults: 2\nKids: 1\nPrice: 49.99\nDate: 2026-08-01 - 2026-08-03\n\nReply 2 if you\'d like to cancel this request — otherwise, a member of our team will confirm it and follow up with you shortly.\n\n[RESERVE feature="Cabana" start="2026-08-01" end="2026-08-03" adults="2" kids="1"]',
      );

    const processor = new MessageFlushProcessor(
      { drain: mockDrain } as any,
      { generateReply: mockGenerateReply } as any,
      {
        get: jest.fn().mockResolvedValue({
          id: 'resort-1',
          name: 'Sunset Bay',
          faqs: [],
          contacts: [],
        }),
      } as any,
      { find: jest.fn().mockResolvedValue([feature]) } as any,
      {
        findLatestPendingForGuest: jest.fn().mockResolvedValue(null),
        countActiveForFeature: jest.fn().mockResolvedValue(0),
        create: mockCreate,
        save: mockSave,
      } as any,
      { isHumanHandled: jest.fn().mockResolvedValue(false) } as any,
      { emit: jest.fn() } as any,
      { sendText: mockSendText },
      mockRedis() as any,
      mockLogger() as any,
    );

    await processor.process(job);

    expect(mockCreate).toHaveBeenCalledWith({
      feature,
      startDate: '2026-08-01',
      endDate: '2026-08-03',
      phoneNumber: '456',
      adults: 2,
      kids: 1,
    });
    expect(mockSave).toHaveBeenCalled();
    // With a resort resolved, delivery happens durably via the desk pipeline instead of a
    // direct send here — see WA_SEND_QUEUE.
    expect(mockSendText).not.toHaveBeenCalled();
  });

  it('does not create a reservation when the referenced feature has no availability left', async () => {
    const mockDrain = jest.fn().mockResolvedValue([
      {
        id: 'msg1',
        text: 'I want to book the Cabana',
        timestamp: 1234567890,
      },
    ]);
    const feature = {
      id: 'feature-1',
      name: 'Cabana',
      price: 49.99,
      quantity: 2,
    };
    const mockSave = jest.fn();
    const mockGenerateReply = jest
      .fn()
      .mockResolvedValue(
        '[RESERVE feature="Cabana" start="2026-08-01" end="2026-08-03" adults="2" kids="0"]',
      );

    const processor = new MessageFlushProcessor(
      { drain: mockDrain } as any,
      { generateReply: mockGenerateReply } as any,
      {
        get: jest.fn().mockResolvedValue({
          id: 'resort-1',
          name: 'Sunset Bay',
          faqs: [],
          contacts: [],
        }),
      } as any,
      { find: jest.fn().mockResolvedValue([feature]) } as any,
      {
        findLatestPendingForGuest: jest.fn().mockResolvedValue(null),
        countActiveForFeature: jest.fn().mockResolvedValue(2),
        create: jest.fn(),
        save: mockSave,
      } as any,
      { isHumanHandled: jest.fn().mockResolvedValue(false) } as any,
      { emit: jest.fn() } as any,
      { sendText: jest.fn() },
      mockRedis() as any,
      mockLogger() as any,
    );

    await processor.process(job);

    expect(mockSave).not.toHaveBeenCalled();
  });

  it('does not create a reservation and strips the marker even when the AI omits adults/kids', async () => {
    const mockDrain = jest.fn().mockResolvedValue([
      {
        id: 'msg1',
        text: 'I want to book the Cabana',
        timestamp: 1234567890,
      },
    ]);
    const feature = {
      id: 'feature-1',
      name: 'Cabana',
      price: 49.99,
      quantity: 5,
    };
    const mockSave = jest.fn();
    const mockSendText = jest.fn();
    // Malformed/incomplete marker (no adults/kids) — the AiRepliedEvent still must never
    // leak the raw "[RESERVE ...]" text to the guest even though it can't be parsed.
    const mockGenerateReply = jest
      .fn()
      .mockResolvedValue(
        'Almost there!\n\n[RESERVE feature="Cabana" start="2026-08-01" end="2026-08-03"]',
      );
    const mockEmit = jest.fn();

    const processor = new MessageFlushProcessor(
      { drain: mockDrain } as any,
      { generateReply: mockGenerateReply } as any,
      {
        get: jest.fn().mockResolvedValue({
          id: 'resort-1',
          name: 'Sunset Bay',
          faqs: [],
          contacts: [],
        }),
      } as any,
      { find: jest.fn().mockResolvedValue([feature]) } as any,
      {
        findLatestPendingForGuest: jest.fn().mockResolvedValue(null),
        countActiveForFeature: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        save: mockSave,
      } as any,
      { isHumanHandled: jest.fn().mockResolvedValue(false) } as any,
      { emit: mockEmit } as any,
      { sendText: mockSendText },
      mockRedis() as any,
      mockLogger() as any,
    );

    await processor.process(job);

    expect(mockSave).not.toHaveBeenCalled();
    const calls = mockEmit.mock.calls as [string, { body: string }][];
    const emittedEvent = calls.find(
      ([eventName]) => eventName === DESK_EVENTS.AI_REPLIED,
    )?.[1] as { body: string };
    expect(emittedEvent.body).not.toContain('[RESERVE');
    expect(emittedEvent.body).toContain('Almost there!');
  });

  it('does not create a reservation when the AI reports zero adults', async () => {
    const mockDrain = jest.fn().mockResolvedValue([
      {
        id: 'msg1',
        text: 'I want to book the Cabana',
        timestamp: 1234567890,
      },
    ]);
    const feature = {
      id: 'feature-1',
      name: 'Cabana',
      price: 49.99,
      quantity: 5,
    };
    const mockSave = jest.fn();
    const mockGenerateReply = jest
      .fn()
      .mockResolvedValue(
        '[RESERVE feature="Cabana" start="2026-08-01" end="2026-08-03" adults="0" kids="2"]',
      );

    const processor = new MessageFlushProcessor(
      { drain: mockDrain } as any,
      { generateReply: mockGenerateReply } as any,
      {
        get: jest.fn().mockResolvedValue({
          id: 'resort-1',
          name: 'Sunset Bay',
          faqs: [],
          contacts: [],
        }),
      } as any,
      { find: jest.fn().mockResolvedValue([feature]) } as any,
      {
        findLatestPendingForGuest: jest.fn().mockResolvedValue(null),
        countActiveForFeature: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        save: mockSave,
      } as any,
      { isHumanHandled: jest.fn().mockResolvedValue(false) } as any,
      { emit: jest.fn() } as any,
      { sendText: jest.fn() },
      mockRedis() as any,
      mockLogger() as any,
    );

    await processor.process(job);

    expect(mockSave).not.toHaveBeenCalled();
  });

  it('acknowledges without changing status when the guest replies "1" (confirming is staff-only)', async () => {
    const mockDrain = jest
      .fn()
      .mockResolvedValue([{ id: 'msg1', text: '1', timestamp: 1234567890 }]);
    const pending = {
      id: 'reservation-1',
      status: ReservationStatus.PENDING,
      feature: { name: 'Cabana' },
    };
    const mockSave = jest.fn((entity: object) => entity);
    const mockSendText = jest.fn();
    const mockGenerateReply = jest.fn();
    const redis = mockRedis();

    const processor = new MessageFlushProcessor(
      { drain: mockDrain } as any,
      { generateReply: mockGenerateReply } as any,
      {
        get: jest.fn().mockResolvedValue({
          id: 'resort-1',
          name: 'Sunset Bay',
          faqs: [],
          contacts: [],
        }),
      } as any,
      { find: jest.fn() } as any,
      {
        findLatestPendingForGuest: jest.fn().mockResolvedValue(pending),
        countActiveForFeature: jest.fn(),
        save: mockSave,
      } as any,
      { isHumanHandled: jest.fn().mockResolvedValue(false) } as any,
      { emit: jest.fn() } as any,
      { sendText: mockSendText },
      redis as any,
      mockLogger() as any,
    );

    await processor.process(job);

    expect(pending.status).toBe(ReservationStatus.PENDING);
    expect(mockSave).not.toHaveBeenCalled();
    expect(mockSendText).toHaveBeenCalledWith(
      '123',
      '456',
      'Thanks! A member of our team will confirm your reservation for Cabana shortly.',
    );
    expect(mockGenerateReply).not.toHaveBeenCalled();
    // Acknowledging is not an AI-answered turn, so it shouldn't count towards the session limit.
    expect(redis.incr).not.toHaveBeenCalled();
  });

  it('declines a pending reservation when the guest replies "2"', async () => {
    const mockDrain = jest
      .fn()
      .mockResolvedValue([{ id: 'msg1', text: '2', timestamp: 1234567890 }]);
    const pending = {
      id: 'reservation-1',
      status: ReservationStatus.PENDING,
      feature: { name: 'Cabana' },
    };
    const mockSave = jest.fn((entity: object) => entity);
    const mockSendText = jest.fn();

    const processor = new MessageFlushProcessor(
      { drain: mockDrain } as any,
      { generateReply: jest.fn() } as any,
      {
        get: jest.fn().mockResolvedValue({
          id: 'resort-1',
          name: 'Sunset Bay',
          faqs: [],
          contacts: [],
        }),
      } as any,
      { find: jest.fn() } as any,
      {
        findLatestPendingForGuest: jest.fn().mockResolvedValue(pending),
        countActiveForFeature: jest.fn(),
        save: mockSave,
      } as any,
      { isHumanHandled: jest.fn().mockResolvedValue(false) } as any,
      { emit: jest.fn() } as any,
      { sendText: mockSendText },
      mockRedis() as any,
      mockLogger() as any,
    );

    await processor.process(job);

    expect(pending.status).toBe(ReservationStatus.DECLINED);
    expect(mockSendText).toHaveBeenCalledWith(
      '123',
      '456',
      'Your reservation for Cabana has been declined.',
    );
  });

  describe('session rate limiting', () => {
    it('skips AI processing entirely while the conversation is cooling down', async () => {
      const mockDrain = jest
        .fn()
        .mockResolvedValue([
          { id: 'msg1', text: 'Hello again', timestamp: 1234567890 },
        ]);
      const mockGenerateReply = jest.fn();
      const mockSendText = jest.fn();
      const redis = mockRedis({ get: jest.fn().mockResolvedValue('1') });

      const processor = new MessageFlushProcessor(
        { drain: mockDrain } as any,
        { generateReply: mockGenerateReply } as any,
        { get: jest.fn().mockResolvedValue(null) } as any,
        { find: jest.fn() } as any,
        {
          findLatestPendingForGuest: jest.fn().mockResolvedValue(null),
          countActiveForFeature: jest.fn(),
        } as any,
        { isHumanHandled: jest.fn().mockResolvedValue(false) } as any,
        { emit: jest.fn() } as any,
        { sendText: mockSendText },
        redis as any,
        mockLogger() as any,
      );

      await processor.process(job);

      expect(redis.get).toHaveBeenCalledWith('wa:cooldown:123:456');
      expect(mockGenerateReply).not.toHaveBeenCalled();
      expect(mockSendText).not.toHaveBeenCalled();
    });

    it('increments and refreshes the session counter after a normal AI-answered turn', async () => {
      const mockDrain = jest
        .fn()
        .mockResolvedValue([
          { id: 'msg1', text: 'Hello', timestamp: 1234567890 },
        ]);
      const redis = mockRedis({ incr: jest.fn().mockResolvedValue(3) });

      const processor = new MessageFlushProcessor(
        { drain: mockDrain } as any,
        { generateReply: jest.fn().mockResolvedValue('Hi there!') } as any,
        { get: jest.fn().mockResolvedValue(null) } as any,
        { find: jest.fn() } as any,
        {
          findLatestPendingForGuest: jest.fn().mockResolvedValue(null),
          countActiveForFeature: jest.fn(),
        } as any,
        { isHumanHandled: jest.fn().mockResolvedValue(false) } as any,
        { emit: jest.fn() } as any,
        { sendText: jest.fn() },
        redis as any,
        mockLogger() as any,
      );

      await processor.process(job);

      expect(redis.incr).toHaveBeenCalledWith('wa:session-count:123:456');
      expect(redis.expire).toHaveBeenCalledWith(
        'wa:session-count:123:456',
        1800,
      );
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('locks the conversation and sends a cooldown notice once the session limit is reached', async () => {
      const mockDrain = jest
        .fn()
        .mockResolvedValue([
          { id: 'msg1', text: 'Hello', timestamp: 1234567890 },
        ]);
      const mockSendText = jest.fn();
      const redis = mockRedis({ incr: jest.fn().mockResolvedValue(15) });

      const processor = new MessageFlushProcessor(
        { drain: mockDrain } as any,
        { generateReply: jest.fn().mockResolvedValue('Hi there!') } as any,
        { get: jest.fn().mockResolvedValue(null) } as any,
        { find: jest.fn() } as any,
        {
          findLatestPendingForGuest: jest.fn().mockResolvedValue(null),
          countActiveForFeature: jest.fn(),
        } as any,
        { isHumanHandled: jest.fn().mockResolvedValue(false) } as any,
        { emit: jest.fn() } as any,
        { sendText: mockSendText },
        redis as any,
        mockLogger() as any,
      );

      await processor.process(job);

      expect(redis.set).toHaveBeenCalledWith(
        'wa:cooldown:123:456',
        '1',
        'EX',
        1800,
      );
      expect(redis.del).toHaveBeenCalledWith('wa:session-count:123:456');
      expect(mockSendText).toHaveBeenNthCalledWith(
        1,
        '123',
        '456',
        'Hi there!',
      );
      expect(mockSendText).toHaveBeenNthCalledWith(
        2,
        '123',
        '456',
        "You've reached the message limit for this conversation. Please try again in 30 minutes.",
      );
    });
  });
});
