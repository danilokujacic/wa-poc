import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { RecordMessageParams } from '../../desk/desk.service';

export const DESK_MESSAGE_QUEUE = 'desk-message';

// Fixed backoff so the total retry window is easy to reason about: 36 attempts
// 5 minutes apart rides out roughly a 3-hour DB outage before giving up.
const RETRY_DELAY_MS = 5 * 60_000;
const RETRY_ATTEMPTS = 36;

@Injectable()
export class DeskMessageProducer {
    constructor(
        @InjectQueue(DESK_MESSAGE_QUEUE) private readonly queue: Queue,
        @InjectPinoLogger(DeskMessageProducer.name) private readonly logger: PinoLogger,
    ) { }

    async enqueue(data: RecordMessageParams): Promise<void> {
        try {
            await this.queue.add('record', data, {
                attempts: RETRY_ATTEMPTS,
                backoff: { type: 'fixed', delay: RETRY_DELAY_MS },
                removeOnComplete: true,
                // Keep permanently-failed jobs around for a day so they're visible for
                // manual inspection/replay instead of silently vanishing.
                removeOnFail: { age: 24 * 3600 },
            });
        } catch (err) {
            this.logger.error(`Error enqueuing desk message for conversation ${data.resortId}:${data.guestPhoneNumber}: ${err}`);
            throw err;
        }
    }
}
