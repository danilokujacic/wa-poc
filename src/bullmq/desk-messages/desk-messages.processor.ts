import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DeskService } from '../../desk/desk.service';
import type { RecordMessageParams } from '../../desk/desk.service';
import { DESK_MESSAGE_QUEUE } from './desk-messages.producer';

@Processor(DESK_MESSAGE_QUEUE, { concurrency: 5 })
export class DeskMessageProcessor extends WorkerHost {
    constructor(
        private readonly deskService: DeskService,
        @InjectPinoLogger(DeskMessageProcessor.name) private readonly logger: PinoLogger,
    ) {
        super();
    }

    async process(job: Job<RecordMessageParams>): Promise<void> {
        const { traceId, resortId, sender } = job.data;
        this.logger.info({ traceId, resortId, sender, attempt: job.attemptsMade + 1 }, 'Persisting message');

        // Unlike MessageFlushProcessor, do NOT catch-and-swallow: a thrown error is what
        // makes BullMQ retry, which is the whole point of this queue (surviving a DB outage
        // or a mid-write server shutdown without losing the message).
        await this.deskService.recordMessage(job.data);
    }

    @OnWorkerEvent('failed')
    onFailed(job: Job<RecordMessageParams> | undefined, error: Error): void {
        if (!job) return;
        const attemptsExhausted = job.attemptsMade >= (job.opts.attempts ?? 1);
        if (attemptsExhausted) {
            this.logger.error(
                { traceId: job.data.traceId, resortId: job.data.resortId, attemptsMade: job.attemptsMade },
                `Desk message permanently failed to persist: ${error}`,
            );
        }
    }
}
