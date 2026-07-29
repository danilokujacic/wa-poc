import { WaSendProducer } from './wa-send.producer';

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

describe('WaSendProducer', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const data = {
        messageId: 'message-1',
        resortId: 'resort-1',
        conversationId: 'conv-1',
        phoneNumberId: 'phone-id-1',
        guestPhoneNumber: '38269280401',
        text: 'On it!',
        traceId: 'message-1',
    };

    it('enqueues a durable, retrying send job', async () => {
        const producer = new WaSendProducer(mockQueue as any, mockLogger as any);
        mockQueue.add.mockResolvedValue({});

        await producer.enqueue(data);

        expect(mockQueue.add).toHaveBeenCalledWith('send', data, expect.objectContaining({
            attempts: 3,
            backoff: { type: 'fixed', delay: 2 * 60_000 },
            removeOnComplete: true,
            removeOnFail: { age: 24 * 3600 },
        }));
    });

    it('logs and rethrows if enqueueing itself fails', async () => {
        const producer = new WaSendProducer(mockQueue as any, mockLogger as any);
        mockQueue.add.mockRejectedValue(new Error('Redis unavailable'));

        await expect(producer.enqueue(data)).rejects.toThrow('Redis unavailable');
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.objectContaining({ traceId: 'message-1', messageId: 'message-1' }),
            expect.stringContaining('Error enqueuing WhatsApp send'),
        );
    });
});
