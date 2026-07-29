import { Inject } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { MessageRepository } from '../../repository/message.repository';
import { MessageDeliveryStatus } from '../../entity/message.entity';
import { DeskGateway } from '../../desk/desk.gateway';
import { MESSAGE_SENDER, WhatsappSendError } from '../messages/message-sender.interface';
import type { MessageSender } from '../messages/message-sender.interface';
import { WA_SEND_QUEUE, WaSendJobData } from './wa-send.producer';

// 4xx (other than 429, which is just rate limiting) means the request itself is bad — a
// stale/invalid token, an invalid recipient — and will fail identically no matter how many
// times we retry it. 5xx/429/network errors are worth retrying; the provider's just having a
// bad moment.
function isRetryable(status: number): boolean {
    if (status === 429) return true;
    return status >= 500;
}

@Processor(WA_SEND_QUEUE, { concurrency: 5 })
export class WaSendProcessor extends WorkerHost {
    constructor(
        @Inject(MESSAGE_SENDER) private readonly messageSender: MessageSender,
        private readonly messageRepository: MessageRepository,
        private readonly deskGateway: DeskGateway,
        @InjectPinoLogger(WaSendProcessor.name) private readonly logger: PinoLogger,
    ) {
        super();
    }

    async process(job: Job<WaSendJobData>): Promise<void> {
        const { messageId, resortId, conversationId, phoneNumberId, guestPhoneNumber, text, traceId } = job.data;

        this.logger.info({ traceId, messageId, attempt: job.attemptsMade + 1 }, 'Attempting WhatsApp delivery');

        try {
            await this.messageSender.sendText(phoneNumberId, guestPhoneNumber, text);
        } catch (error) {
            // Skips BullMQ's remaining retries entirely — no point waiting out a backoff window
            // for a failure that can't self-resolve. Surfaces as "Failed" immediately instead.
            if (error instanceof WhatsappSendError && !isRetryable(error.status)) {
                this.logger.warn({ traceId, messageId }, `Permanent send failure (status ${error.status}), not retrying`);
                throw new UnrecoverableError(error.message);
            }
            // Anything else (transient/5xx/network) — deliberately let it propagate uncaught so
            // BullMQ retries per WaSendProducer's backoff.
            this.logger.warn({ traceId, messageId }, `Transient send failure, will retry: ${error}`);
            throw error;
        }

        this.logger.info({ traceId, messageId }, 'WhatsApp delivery confirmed');
        await this.updateDeliveryStatus(resortId, conversationId, messageId, MessageDeliveryStatus.SENT, traceId);
    }

    @OnWorkerEvent('failed')
    async onFailed(job: Job<WaSendJobData> | undefined, error: Error): Promise<void> {
        if (!job) return;
        const attemptsExhausted = job.attemptsMade >= (job.opts.attempts ?? 1);
        const isUnrecoverable = error instanceof UnrecoverableError;
        if (!attemptsExhausted && !isUnrecoverable) return;

        this.logger.error(
            { traceId: job.data.traceId, messageId: job.data.messageId, attemptsMade: job.attemptsMade },
            `WhatsApp send permanently failed: ${error}`,
        );
        await this.updateDeliveryStatus(job.data.resortId, job.data.conversationId, job.data.messageId, MessageDeliveryStatus.FAILED, job.data.traceId);
    }

    private async updateDeliveryStatus(
        resortId: string,
        conversationId: string,
        messageId: string,
        deliveryStatus: MessageDeliveryStatus,
        traceId: string,
    ): Promise<void> {
        await this.messageRepository.update(messageId, { deliveryStatus });
        this.logger.info({ traceId, messageId, deliveryStatus }, 'Delivery status updated');
        this.deskGateway.emitMessageStatusUpdated(resortId, { conversationId, messageId, deliveryStatus });
    }
}
