import { Test } from "@nestjs/testing";
import { MESSAGE_SENDER } from "./message-sender.interface";
import { ResortContextService } from "src/resort/resort-context.service";
import { ResortFeatureRepository } from "src/repository/resort-feature.repository";
import { ReservationRepository } from "src/repository/reservation.repository";
import { REDIS_CLIENT } from "src/redis/redis.provider";
import { MessageBatchProducer } from "./messages.producer";
import { MessageFlushProcessor } from "./messages.processor";
import { AiService } from "src/ai/ai.service";
import { ReservationStatus } from "src/entity/reservation.entity";

function mockRedis(overrides: Partial<Record<'get' | 'incr' | 'expire' | 'set' | 'del', jest.Mock>> = {}) {
    return {
        get: jest.fn().mockResolvedValue(null),
        incr: jest.fn().mockResolvedValue(1),
        expire: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
        ...overrides,
    };
}

describe('MessageProcessor', () => {

    beforeEach(() => {
        Test.createTestingModule({
            providers: [
                MessageFlushProcessor,
                {
                    provide: MessageBatchProducer,
                    useValue: {
                        drain: jest.fn().mockResolvedValue([]),
                    },
                },
                {
                    provide: AiService,
                    useValue: {
                        generateReply: jest.fn().mockResolvedValue(""),
                    },
                },
                {
                    provide: ResortContextService,
                    useValue: {
                        get: jest.fn().mockResolvedValue(null),
                    },
                },
                {
                    provide: ResortFeatureRepository,
                    useValue: {
                        find: jest.fn().mockResolvedValue([]),
                    },
                },
                {
                    provide: ReservationRepository,
                    useValue: {
                        findLatestPendingForGuest: jest.fn().mockResolvedValue(null),
                        countActiveForFeature: jest.fn().mockResolvedValue(0),
                        create: jest.fn((dto) => dto),
                        save: jest.fn(async (entity) => entity),
                    },
                },
                {
                    provide: MESSAGE_SENDER,
                    useValue: {
                        sendText: jest.fn(),
                    },
                },
                {
                    provide: REDIS_CLIENT,
                    useValue: mockRedis(),
                },
            ],
        }).compile();

    });

    const job = {
        data: {
            conversationKey: '123:456',
            phoneNumberId: '123',
            guestNumber: '456',
            guestName: 'John Doe',
        },
    } as any;

    it('should return early if there are no messages to flush', async () => {
        const processor = new MessageFlushProcessor(
            { drain: jest.fn().mockResolvedValue([]) } as any,
            new AiService(null as any),
            { get: jest.fn() } as any,
            { find: jest.fn() } as any,
            { findLatestPendingForGuest: jest.fn(), countActiveForFeature: jest.fn() } as any,
            { sendText: jest.fn() } as any,
            mockRedis() as any,
        );

        await processor.process(job);

        expect(processor['producer'].drain).toHaveBeenCalledWith('123:456');
    });
    it('should process messages and send a reply', async () => {
        const mockDrain = jest.fn().mockResolvedValue([
            { id: 'msg1', text: 'Hello', timestamp: 1234567890 },
            { id: 'msg2', text: 'How are you?', timestamp: 1234567891 },
        ]);

        const mockGenerateReply = jest.fn().mockResolvedValue('I am fine, thank you!');

        const mockSendText = jest.fn();

        const processor = new MessageFlushProcessor(
            { drain: mockDrain } as any,
            { generateReply: mockGenerateReply } as any,
            { get: jest.fn().mockResolvedValue(null) } as any,
            { find: jest.fn() } as any,
            { findLatestPendingForGuest: jest.fn(), countActiveForFeature: jest.fn() } as any,
            { sendText: mockSendText } as any,
            mockRedis() as any,
        );

        await processor.process(job);

        expect(mockDrain).toHaveBeenCalledWith('123:456');
        expect(mockGenerateReply).toHaveBeenCalledWith('John Doe', expect.any(String));
        expect(mockSendText).toHaveBeenCalledWith('123', '456', 'I am fine, thank you!');
    });
    it('replies gracefully instead of throwing when the AI service fails', async () => {
        const mockDrain = jest.fn().mockResolvedValue([
            { id: 'msg1', text: 'Hello', timestamp: 1234567890 },
        ]);

        const mockGenerateReply = jest.fn().mockRejectedValue(new Error('AI service error'));

        const mockSendText = jest.fn();
        const redis = mockRedis();

        const processor = new MessageFlushProcessor(
            { drain: mockDrain } as any,
            { generateReply: mockGenerateReply } as any,
            { get: jest.fn().mockResolvedValue(null) } as any,
            { find: jest.fn() } as any,
            { findLatestPendingForGuest: jest.fn(), countActiveForFeature: jest.fn() } as any,
            { sendText: mockSendText } as any,
            redis as any,
        );

        await expect(processor.process(job)).resolves.toBeUndefined();

        expect(mockDrain).toHaveBeenCalledWith('123:456');
        expect(mockGenerateReply).toHaveBeenCalledWith('John Doe', expect.any(String));
        expect(mockSendText).toHaveBeenCalledWith(
            '123',
            '456',
            "We're experiencing high demand right now and couldn't process your message. Please try again in a few minutes.",
        );
        // A failed AI turn shouldn't burn the guest's session budget.
        expect(redis.incr).not.toHaveBeenCalled();
    });
    it('should build prompt correctly with resort FAQs', async () => {
        const mockDrain = jest.fn().mockResolvedValue([
            { id: 'msg1', text: 'Hello', timestamp: 1234567890 },
        ]);

        const mockGenerateReply = jest.fn().mockResolvedValue('I am fine, thank you!');

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
            { find: jest.fn() } as any,
            { findLatestPendingForGuest: jest.fn().mockResolvedValue(null), countActiveForFeature: jest.fn() } as any,
            { sendText: mockSendText } as any,
            mockRedis() as any,
        );

        await processor.process(job);

        expect(mockDrain).toHaveBeenCalledWith('123:456');
        expect(mockGenerateReply).toHaveBeenCalledWith('John Doe', expect.stringContaining('Q: Q?\nA: A.'));
        expect(mockSendText).toHaveBeenCalledWith('123', '456', 'I am fine, thank you!');
    });
    it('should build prompt correctly without resort FAQs', async () => {
        const mockDrain = jest.fn().mockResolvedValue([
            { id: 'msg1', text: 'Hello', timestamp: 1234567890 },
        ]);

        const mockGenerateReply = jest.fn().mockResolvedValue('I am fine, thank you!');

        const mockSendText = jest.fn();

        const processor = new MessageFlushProcessor(
            { drain: mockDrain } as any,
            { generateReply: mockGenerateReply } as any,
            { get: jest.fn().mockResolvedValue(null) } as any,
            { find: jest.fn() } as any,
            { findLatestPendingForGuest: jest.fn(), countActiveForFeature: jest.fn() } as any,
            { sendText: mockSendText } as any,
            mockRedis() as any,
        );

        await processor.process(job);

        expect(mockDrain).toHaveBeenCalledWith('123:456');
        expect(mockGenerateReply).toHaveBeenCalledWith('John Doe', expect.any(String));
        expect(mockSendText).toHaveBeenCalledWith('123', '456', 'I am fine, thank you!');
    });
    it('should handle errors when sending text', async () => {
        const mockDrain = jest.fn().mockResolvedValue([
            { id: 'msg1', text: 'Hello', timestamp: 1234567890 },
        ]);

        const mockGenerateReply = jest.fn().mockResolvedValue('I am fine, thank you!');

        const mockSendText = jest.fn().mockRejectedValue(new Error('Send text error'));

        const processor = new MessageFlushProcessor(
            { drain: mockDrain } as any,
            { generateReply: mockGenerateReply } as any,
            { get: jest.fn().mockResolvedValue(null) } as any,
            { find: jest.fn() } as any,
            { findLatestPendingForGuest: jest.fn(), countActiveForFeature: jest.fn() } as any,
            { sendText: mockSendText } as any,
            mockRedis() as any,
        );

        await expect(processor.process(job)).rejects.toThrow('Send text error');

        expect(mockDrain).toHaveBeenCalledWith('123:456');
        expect(mockGenerateReply).toHaveBeenCalledWith('John Doe', expect.any(String));
        expect(mockSendText).toHaveBeenCalledWith('123', '456', 'I am fine, thank you!');
    });

    it('does not fetch features when the guest message is not booking-related', async () => {
        const mockDrain = jest.fn().mockResolvedValue([
            { id: 'msg1', text: 'Hello there', timestamp: 1234567890 },
        ]);
        const mockFind = jest.fn().mockResolvedValue([]);

        const processor = new MessageFlushProcessor(
            { drain: mockDrain } as any,
            { generateReply: jest.fn().mockResolvedValue('Hi!') } as any,
            { get: jest.fn().mockResolvedValue({ id: 'resort-1', name: 'Sunset Bay', faqs: [], contacts: [] }) } as any,
            { find: mockFind } as any,
            { findLatestPendingForGuest: jest.fn().mockResolvedValue(null), countActiveForFeature: jest.fn() } as any,
            { sendText: jest.fn() } as any,
            mockRedis() as any,
        );

        await processor.process(job);

        expect(mockFind).not.toHaveBeenCalled();
    });

    it('fetches features and availability when the guest message is booking-related', async () => {
        const mockDrain = jest.fn().mockResolvedValue([
            { id: 'msg1', text: 'How much does the Cabana cost to book?', timestamp: 1234567890 },
        ]);
        const feature = { id: 'feature-1', name: 'Cabana', price: 49.99, quantity: 5 };
        const mockFind = jest.fn().mockResolvedValue([feature]);
        const mockCountActive = jest.fn().mockResolvedValue(2);
        const mockGenerateReply = jest.fn().mockResolvedValue('It costs $49.99, 3 left!');

        const processor = new MessageFlushProcessor(
            { drain: mockDrain } as any,
            { generateReply: mockGenerateReply } as any,
            { get: jest.fn().mockResolvedValue({ id: 'resort-1', name: 'Sunset Bay', faqs: [], contacts: [] }) } as any,
            { find: mockFind } as any,
            { findLatestPendingForGuest: jest.fn().mockResolvedValue(null), countActiveForFeature: mockCountActive } as any,
            { sendText: jest.fn() } as any,
            mockRedis() as any,
        );

        await processor.process(job);

        expect(mockFind).toHaveBeenCalledWith({ where: { resort: { id: 'resort-1' } } });
        expect(mockCountActive).toHaveBeenCalledWith('feature-1');
        expect(mockGenerateReply).toHaveBeenCalledWith('John Doe', expect.stringContaining('available 3/5'));
    });

    it('creates a pending reservation when the AI reply includes the reservation marker', async () => {
        const mockDrain = jest.fn().mockResolvedValue([
            { id: 'msg1', text: 'I want to book the Cabana', timestamp: 1234567890 },
        ]);
        const feature = { id: 'feature-1', name: 'Cabana', price: 49.99, quantity: 5 };
        const mockSendText = jest.fn();
        const mockSave = jest.fn(async (entity) => entity);
        const mockCreate = jest.fn((dto) => dto);
        const mockGenerateReply = jest
            .fn()
            .mockResolvedValue(
                'Sure! Reply 1 to confirm or 2 to decline.\n\n[RESERVE feature="Cabana" start="2026-08-01" end="2026-08-03"]',
            );

        const processor = new MessageFlushProcessor(
            { drain: mockDrain } as any,
            { generateReply: mockGenerateReply } as any,
            { get: jest.fn().mockResolvedValue({ id: 'resort-1', name: 'Sunset Bay', faqs: [], contacts: [] }) } as any,
            { find: jest.fn().mockResolvedValue([feature]) } as any,
            {
                findLatestPendingForGuest: jest.fn().mockResolvedValue(null),
                countActiveForFeature: jest.fn().mockResolvedValue(0),
                create: mockCreate,
                save: mockSave,
            } as any,
            { sendText: mockSendText } as any,
            mockRedis() as any,
        );

        await processor.process(job);

        expect(mockCreate).toHaveBeenCalledWith({
            feature,
            startDate: '2026-08-01',
            endDate: '2026-08-03',
            phoneNumber: '456',
        });
        expect(mockSave).toHaveBeenCalled();
        expect(mockSendText).toHaveBeenCalledWith('123', '456', 'Sure! Reply 1 to confirm or 2 to decline.');
    });

    it('does not create a reservation when the referenced feature has no availability left', async () => {
        const mockDrain = jest.fn().mockResolvedValue([
            { id: 'msg1', text: 'I want to book the Cabana', timestamp: 1234567890 },
        ]);
        const feature = { id: 'feature-1', name: 'Cabana', price: 49.99, quantity: 2 };
        const mockSave = jest.fn();
        const mockGenerateReply = jest
            .fn()
            .mockResolvedValue('[RESERVE feature="Cabana" start="2026-08-01" end="2026-08-03"]');

        const processor = new MessageFlushProcessor(
            { drain: mockDrain } as any,
            { generateReply: mockGenerateReply } as any,
            { get: jest.fn().mockResolvedValue({ id: 'resort-1', name: 'Sunset Bay', faqs: [], contacts: [] }) } as any,
            { find: jest.fn().mockResolvedValue([feature]) } as any,
            {
                findLatestPendingForGuest: jest.fn().mockResolvedValue(null),
                countActiveForFeature: jest.fn().mockResolvedValue(2),
                create: jest.fn(),
                save: mockSave,
            } as any,
            { sendText: jest.fn() } as any,
            mockRedis() as any,
        );

        await processor.process(job);

        expect(mockSave).not.toHaveBeenCalled();
    });

    it('accepts a pending reservation when the guest replies "1"', async () => {
        const mockDrain = jest.fn().mockResolvedValue([
            { id: 'msg1', text: '1', timestamp: 1234567890 },
        ]);
        const pending = { id: 'reservation-1', status: ReservationStatus.PENDING, feature: { name: 'Cabana' } };
        const mockSave = jest.fn(async (entity) => entity);
        const mockSendText = jest.fn();
        const mockGenerateReply = jest.fn();
        const redis = mockRedis();

        const processor = new MessageFlushProcessor(
            { drain: mockDrain } as any,
            { generateReply: mockGenerateReply } as any,
            { get: jest.fn().mockResolvedValue({ id: 'resort-1', name: 'Sunset Bay', faqs: [], contacts: [] }) } as any,
            { find: jest.fn() } as any,
            {
                findLatestPendingForGuest: jest.fn().mockResolvedValue(pending),
                countActiveForFeature: jest.fn(),
                save: mockSave,
            } as any,
            { sendText: mockSendText } as any,
            redis as any,
        );

        await processor.process(job);

        expect(pending.status).toBe(ReservationStatus.ACCEPTED);
        expect(mockSave).toHaveBeenCalledWith(pending);
        expect(mockSendText).toHaveBeenCalledWith('123', '456', 'Your reservation for Cabana has been confirmed!');
        expect(mockGenerateReply).not.toHaveBeenCalled();
        // Confirming a reservation is not an AI-answered turn, so it shouldn't count towards the session limit.
        expect(redis.incr).not.toHaveBeenCalled();
    });

    it('declines a pending reservation when the guest replies "2"', async () => {
        const mockDrain = jest.fn().mockResolvedValue([
            { id: 'msg1', text: '2', timestamp: 1234567890 },
        ]);
        const pending = { id: 'reservation-1', status: ReservationStatus.PENDING, feature: { name: 'Cabana' } };
        const mockSave = jest.fn(async (entity) => entity);
        const mockSendText = jest.fn();

        const processor = new MessageFlushProcessor(
            { drain: mockDrain } as any,
            { generateReply: jest.fn() } as any,
            { get: jest.fn().mockResolvedValue({ id: 'resort-1', name: 'Sunset Bay', faqs: [], contacts: [] }) } as any,
            { find: jest.fn() } as any,
            {
                findLatestPendingForGuest: jest.fn().mockResolvedValue(pending),
                countActiveForFeature: jest.fn(),
                save: mockSave,
            } as any,
            { sendText: mockSendText } as any,
            mockRedis() as any,
        );

        await processor.process(job);

        expect(pending.status).toBe(ReservationStatus.DECLINED);
        expect(mockSendText).toHaveBeenCalledWith('123', '456', 'Your reservation for Cabana has been declined.');
    });

    describe('session rate limiting', () => {
        it('skips AI processing entirely while the conversation is cooling down', async () => {
            const mockDrain = jest.fn().mockResolvedValue([
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
                { findLatestPendingForGuest: jest.fn().mockResolvedValue(null), countActiveForFeature: jest.fn() } as any,
                { sendText: mockSendText } as any,
                redis as any,
            );

            await processor.process(job);

            expect(redis.get).toHaveBeenCalledWith('wa:cooldown:123:456');
            expect(mockGenerateReply).not.toHaveBeenCalled();
            expect(mockSendText).not.toHaveBeenCalled();
        });

        it('increments and refreshes the session counter after a normal AI-answered turn', async () => {
            const mockDrain = jest.fn().mockResolvedValue([
                { id: 'msg1', text: 'Hello', timestamp: 1234567890 },
            ]);
            const redis = mockRedis({ incr: jest.fn().mockResolvedValue(3) });

            const processor = new MessageFlushProcessor(
                { drain: mockDrain } as any,
                { generateReply: jest.fn().mockResolvedValue('Hi there!') } as any,
                { get: jest.fn().mockResolvedValue(null) } as any,
                { find: jest.fn() } as any,
                { findLatestPendingForGuest: jest.fn().mockResolvedValue(null), countActiveForFeature: jest.fn() } as any,
                { sendText: jest.fn() } as any,
                redis as any,
            );

            await processor.process(job);

            expect(redis.incr).toHaveBeenCalledWith('wa:session-count:123:456');
            expect(redis.expire).toHaveBeenCalledWith('wa:session-count:123:456', 1800);
            expect(redis.set).not.toHaveBeenCalled();
        });

        it('locks the conversation and sends a cooldown notice once the session limit is reached', async () => {
            const mockDrain = jest.fn().mockResolvedValue([
                { id: 'msg1', text: 'Hello', timestamp: 1234567890 },
            ]);
            const mockSendText = jest.fn();
            const redis = mockRedis({ incr: jest.fn().mockResolvedValue(10) });

            const processor = new MessageFlushProcessor(
                { drain: mockDrain } as any,
                { generateReply: jest.fn().mockResolvedValue('Hi there!') } as any,
                { get: jest.fn().mockResolvedValue(null) } as any,
                { find: jest.fn() } as any,
                { findLatestPendingForGuest: jest.fn().mockResolvedValue(null), countActiveForFeature: jest.fn() } as any,
                { sendText: mockSendText } as any,
                redis as any,
            );

            await processor.process(job);

            expect(redis.set).toHaveBeenCalledWith('wa:cooldown:123:456', '1', 'EX', 1800);
            expect(redis.del).toHaveBeenCalledWith('wa:session-count:123:456');
            expect(mockSendText).toHaveBeenNthCalledWith(1, '123', '456', 'Hi there!');
            expect(mockSendText).toHaveBeenNthCalledWith(
                2,
                '123',
                '456',
                "You've reached the message limit for this conversation. Please try again in 30 minutes.",
            );
        });
    });
});
