import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Channex relays every OTA booking notification from its own infrastructure,
 * not the guest's device — one fixed tracker key gives this endpoint a single
 * shared rate-limit budget, same reasoning as the WhatsApp webhook's guard.
 */
@Injectable()
export class ChannexWebhookThrottlerGuard extends ThrottlerGuard {
    protected async getTracker(): Promise<string> {
        return 'channex-webhook';
    }
}
