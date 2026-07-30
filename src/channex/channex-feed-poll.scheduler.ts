import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ChannexApiClient } from './channex-api.client';
import { ChannexBookingSyncService } from './channex-booking-sync.service';
import { ChannexBookingRevision } from './channex-booking-revision.interface';

const MAX_PAGES_PER_RUN = 100;

@Injectable()
export class ChannexFeedPollScheduler {
    private readonly logger = new Logger(ChannexFeedPollScheduler.name);

    constructor(
        private readonly channexApiClient: ChannexApiClient,
        private readonly channexBookingSyncService: ChannexBookingSyncService,
    ) { }

    /**
     * Backstop for the webhook: catches revisions whose webhook delivery was
     * missed (endpoint down, network blip). Every 15 minutes is two cycles
     * inside the feed's 30-minute unacked-revision expiry window, so a single
     * missed run still leaves margin before anything drops out of the feed.
     */
    @Cron('*/15 * * * *')
    async drainFeed(): Promise<void> {
        let processed = 0;

        for (let page = 0; page < MAX_PAGES_PER_RUN; page++) {
            const { data: revisions, meta } = await this.channexApiClient.getWithMeta<ChannexBookingRevision[]>(
                '/booking_revisions/feed',
            );
            if (revisions.length === 0) {
                break;
            }

            for (const revision of revisions) {
                await this.applyOne(revision);
                processed++;
            }

            if (!meta || meta.total <= meta.limit) {
                break;
            }
        }

        if (processed > 0) {
            this.logger.log(`Channex feed poll processed ${processed} revision(s)`);
        }
    }

    private async applyOne(revision: ChannexBookingRevision): Promise<void> {
        try {
            await this.channexBookingSyncService.applyRevision(revision);
            await this.channexApiClient.post(`/booking_revisions/${revision.id}/ack`);
        } catch (err) {
            // Leave un-acked so it's retried on the next poll within the 30-minute
            // window; keep draining the rest instead of blocking the whole batch.
            this.logger.error(`Failed to apply Channex revision ${revision.id}, will retry: ${(err as Error).message}`);
        }
    }
}
