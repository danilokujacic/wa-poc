import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { ChannexAriService } from '../../channex/channex-ari.service';
import { ChannexApiError } from '../../channex/channex-api.client';
import { CHANNEX_ARI_QUEUE, ChannexAriJobData } from './channex-ari.producer';

// 4xx (other than 429) means the request itself is malformed/rejected and
// will fail identically on retry; 5xx/429/network errors are worth retrying.
function isRetryable(status: number): boolean {
  if (status === 429) return true;
  return status >= 500;
}

@Processor(CHANNEX_ARI_QUEUE, { concurrency: 5 })
export class ChannexAriProcessor extends WorkerHost {
  constructor(
    private readonly channexAriService: ChannexAriService,
    @InjectPinoLogger(ChannexAriProcessor.name)
    private readonly logger: PinoLogger,
  ) {
    super();
  }

  async process(job: Job<ChannexAriJobData>): Promise<void> {
    const { featureId, kind } = job.data;

    try {
      if (kind === 'availability') {
        await this.channexAriService.pushAvailability(featureId);
      } else {
        await this.channexAriService.pushRestrictions(featureId);
      }
    } catch (error) {
      if (error instanceof ChannexApiError && !isRetryable(error.status)) {
        this.logger.warn(
          `Permanent Channex ${kind} push failure for feature ${featureId} (status ${error.status}), not retrying: ${error.message}`,
        );
        throw new UnrecoverableError(error.message);
      }
      this.logger.warn(
        `Transient Channex ${kind} push failure for feature ${featureId}, will retry: ${error}`,
      );
      throw error;
    }
  }
}
