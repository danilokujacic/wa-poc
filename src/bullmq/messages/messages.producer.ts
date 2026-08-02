import { Inject, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { REDIS_CLIENT } from 'src/redis/redis.provider';
import { ResortContextService } from 'src/resort/resort-context.service';

export const MESSAGE_FLUSH_QUEUE = 'message-flush';
export const DEBOUNCE_MS = 6_000;

export interface FlushJobData {
  conversationKey: string; // `${phoneNumberId}:${guestNumber}`
  phoneNumberId: string;
  guestNumber: string;
  guestName: string;
}

export interface StoredMessage {
  id: string;
  text: string;
  timestamp: number;
}

@Injectable()
export class MessageBatchProducer {
  constructor(
    @InjectQueue(MESSAGE_FLUSH_QUEUE) private readonly queue: Queue,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly resortContextService: ResortContextService,
    @InjectPinoLogger(MessageBatchProducer.name)
    private readonly logger: PinoLogger,
  ) {}

  async addMessage(data: FlushJobData, message: StoredMessage): Promise<void> {
    const { conversationKey, phoneNumberId } = data;
    const listKey = `wa:buffer:${conversationKey}`;
    const dedupKey = `wa:seen:${message.id}`;

    // Best-effort, non-blocking: get the resort context hot in Redis before
    // the debounce window elapses, so the flush processor doesn't pay for it.
    void this.resortContextService.warm(conversationKey, phoneNumberId);

    const firstTime = await this.redis.set(dedupKey, '1', 'EX', 3600, 'NX');
    if (!firstTime) {
      this.logger.debug(`Duplicate message ${message.id} ignored`);
      return;
    }

    try {
      await this.redis.rpush(listKey, JSON.stringify(message));
      await this.redis.expire(listKey, 3600);
    } catch (err) {
      this.logger.error(
        `Error buffering message ${message.id} for ${conversationKey}: ${err}`,
      );
      throw err;
    }

    const jobId = `flush:${conversationKey}`;
    try {
      const existing = await this.queue.getJob(jobId);
      if (existing) {
        const state = await existing.getState();
        if (state === 'delayed' || state === 'waiting') {
          await existing.remove();
        }
      }

      try {
        await this.queue.add('flush', data, {
          jobId,
          delay: DEBOUNCE_MS,
          removeOnComplete: true,
          removeOnFail: 50,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2_000 },
        });
      } catch {
        await this.queue.add('flush', data, {
          jobId: `${jobId}:${Date.now()}`,
          delay: DEBOUNCE_MS,
          removeOnComplete: true,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2_000 },
        });
      }
    } catch (err) {
      this.logger.error(
        `Error scheduling flush job for ${conversationKey}: ${err}`,
      );
      throw err;
    }

    const pending = await this.redis.llen(listKey);
    this.logger.debug(
      `Buffered message ${message.id} for ${conversationKey}. Pending: ${pending}`,
    );
  }

  async drain(conversationKey: string): Promise<StoredMessage[]> {
    const listKey = `wa:buffer:${conversationKey}`;
    try {
      const results = await this.redis
        .multi()
        .lrange(listKey, 0, -1)
        .del(listKey)
        .exec();

      const raw = (results?.[0]?.[1] as string[]) ?? [];
      return raw
        .map((s) => JSON.parse(s) as StoredMessage)
        .sort((a, b) => a.timestamp - b.timestamp);
    } catch (err) {
      this.logger.error(
        `Error draining messages for ${conversationKey}: ${err}`,
      );
      return [];
    }
  }
}
