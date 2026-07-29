import { DeskMessageProcessor } from './desk-messages.processor';
import { MessageSenderType } from '../../entity/message.entity';

const mockLogger = {
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
};

describe('DeskMessageProcessor', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const job = {
        data: {
            resortId: 'resort-1',
            guestPhoneNumber: '38269280401',
            sender: MessageSenderType.GUEST,
            body: 'Hello',
            sentAt: '2026-01-01T10:00:00.000Z',
            traceId: 'wamid.123',
        },
        attemptsMade: 0,
    } as any;

    it('persists the message via DeskService', async () => {
        const mockRecordMessage = jest.fn().mockResolvedValue({ id: 'message-1' });
        const processor = new DeskMessageProcessor({ recordMessage: mockRecordMessage } as any, mockLogger as any);

        await processor.process(job);

        expect(mockRecordMessage).toHaveBeenCalledWith(job.data);
    });

    it('lets a DB failure propagate so BullMQ retries', async () => {
        const mockRecordMessage = jest.fn().mockRejectedValue(new Error('DB down'));
        const processor = new DeskMessageProcessor({ recordMessage: mockRecordMessage } as any, mockLogger as any);

        await expect(processor.process(job)).rejects.toThrow('DB down');
    });

    it('logs once retries are exhausted', () => {
        const processor = new DeskMessageProcessor({ recordMessage: jest.fn() } as any, mockLogger as any);
        const failedJob = { ...job, attemptsMade: 36, opts: { attempts: 36 } };

        processor.onFailed(failedJob, new Error('DB down'));

        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.objectContaining({ traceId: 'wamid.123', resortId: 'resort-1' }),
            expect.stringContaining('permanently failed'),
        );
    });

    it('does not log while attempts remain', () => {
        const processor = new DeskMessageProcessor({ recordMessage: jest.fn() } as any, mockLogger as any);
        const retryingJob = { ...job, attemptsMade: 2, opts: { attempts: 36 } };

        processor.onFailed(retryingJob, new Error('DB down'));

        expect(mockLogger.error).not.toHaveBeenCalled();
    });
});
