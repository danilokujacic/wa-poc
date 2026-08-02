import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

export const WA_SEND_QUEUE = 'wa-send';

export interface WaSendJobData {
  messageId: string;
  resortId: string;
  conversationId: string;
  phoneNumberId: string;
  guestPhoneNumber: string;
  text: string;
  /** Correlation id for this message's originating flow — see desk.events.ts. */
  traceId: string;
}

// Short automatic window: catches transient blips (rate limiting, a bad moment on WhatsApp's
// end) without leaving an employee staring at "Pending" for hours. Permanent failures (bad
// credentials, invalid recipient) don't even get this far — WaSendProcessor fails those
// immediately via UnrecoverableError. Anything that exhausts these retries surfaces as "Failed"
// within minutes, and the employee can manually retry from there — see DeskService.retryMessageDelivery.
const RETRY_DELAY_MS = 2 * 60_000;
const RETRY_ATTEMPTS = 3;

@Injectable()
export class WaSendProducer {
  constructor(
    @InjectQueue(WA_SEND_QUEUE) private readonly queue: Queue,
    @InjectPinoLogger(WaSendProducer.name) private readonly logger: PinoLogger,
  ) {}

  async enqueue(data: WaSendJobData): Promise<void> {
    try {
      await this.queue.add('send', data, {
        attempts: RETRY_ATTEMPTS,
        backoff: { type: 'fixed', delay: RETRY_DELAY_MS },
        removeOnComplete: true,
        removeOnFail: { age: 24 * 3600 },
      });
    } catch (err) {
      this.logger.error(
        { traceId: data.traceId, messageId: data.messageId },
        `Error enqueuing WhatsApp send: ${err}`,
      );
      throw err;
    }
  }
}
