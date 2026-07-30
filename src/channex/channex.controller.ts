import {
  Body,
  Controller,
  HttpCode,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ChannexWebhookGuard } from './guards/channex-webhook.guard';
import { ChannexWebhookThrottlerGuard } from './guards/channex-webhook-throttler.guard';
import { ChannexBookingSyncService } from './channex-booking-sync.service';
import type { ChannexWebhookPayload } from './channex-booking-revision.interface';

@Controller('channex')
export class ChannexController {
  private readonly logger = new Logger(ChannexController.name);

  constructor(
    private readonly channexBookingSyncService: ChannexBookingSyncService,
  ) {}

  // Guard order matters: verify the shared secret before this request can
  // consume any of the shared rate-limit budget (same reasoning as the
  // WhatsApp webhook's guard ordering).
  @Post('webhook')
  @UseGuards(ChannexWebhookGuard, ChannexWebhookThrottlerGuard)
  @HttpCode(200)
  handleWebhook(@Body() body: ChannexWebhookPayload) {
    const revisionId = body?.payload?.revision_id;
    if (!revisionId) {
      this.logger.warn(
        'Received Channex webhook with no revision_id, ignoring',
      );
      return { received: true };
    }

    // The webhook is just a notification; GET /booking_revisions/:id (done
    // inside applyAndAckRevision) is the source of truth. Process async and
    // ack fast so Channex doesn't retry the callback itself.
    this.channexBookingSyncService
      .applyAndAckRevision(revisionId)
      .catch((err) => {
        this.logger.error(
          `Failed to process Channex revision ${revisionId}: ${err.message}`,
        );
      });

    return { received: true };
  }
}
