import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

export const CHANNEX_ARI_QUEUE = 'channex-ari';

export type ChannexAriPushKind = 'availability' | 'restrictions';

export interface ChannexAriJobData {
  featureId: string;
  kind: ChannexAriPushKind;
}

// Coalesces a burst of writes to one feature (e.g. several reservations
// created in quick succession) into a single push a few seconds later,
// instead of one HTTP call per write.
export const DEBOUNCE_MS = 10_000;

@Injectable()
export class ChannexAriProducer {
  constructor(
    @InjectQueue(CHANNEX_ARI_QUEUE) private readonly queue: Queue,
    @InjectPinoLogger(ChannexAriProducer.name)
    private readonly logger: PinoLogger,
  ) {}

  enqueueAvailabilityPush(featureId: string): Promise<void> {
    return this.enqueue('availability', featureId);
  }

  enqueueRestrictionsPush(featureId: string): Promise<void> {
    return this.enqueue('restrictions', featureId);
  }

  // Never throws: a queue failure here must not fail the booking/pricing
  // write that triggered it, so every call site can fire-and-forget.
  private async enqueue(
    kind: ChannexAriPushKind,
    featureId: string,
  ): Promise<void> {
    const jobId = `channex-ari:${kind}:${featureId}`;
    const data: ChannexAriJobData = { featureId, kind };

    try {
      // A prior push under this jobId may already be sitting in a terminal
      // state (completed, or failed after exhausting its retries) rather
      // than delayed/waiting. BullMQ silently no-ops `add()` for a jobId
      // that already exists in *any* state, so leaving a terminal job in
      // place here would permanently block every future debounced push for
      // this feature+kind. Only 'active' (currently executing) is left
      // alone, since removing an in-flight job isn't safe.
      const existing = await this.queue.getJob(jobId);
      if (existing) {
        const state = await existing.getState();
        if (state !== 'active') {
          await existing.remove();
        }
      }

      try {
        await this.queue.add(kind, data, {
          jobId,
          delay: DEBOUNCE_MS,
          removeOnComplete: true,
          removeOnFail: 50,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2_000 },
        });
      } catch {
        await this.queue.add(kind, data, {
          jobId: `${jobId}:${Date.now()}`,
          delay: DEBOUNCE_MS,
          removeOnComplete: true,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2_000 },
        });
      }
    } catch (err) {
      this.logger.error(
        `Error scheduling Channex ${kind} push for feature ${featureId}: ${err}`,
      );
    }
  }
}
