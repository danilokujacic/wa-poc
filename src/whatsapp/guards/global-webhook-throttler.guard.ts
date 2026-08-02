import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Meta relays every inbound WhatsApp message from its own infrastructure, not
 * the guest's device — so per-IP tracking (the default) wouldn't cap aggregate
 * volume from many distinct senders/devices, it would just track Meta's relay.
 * Using one fixed tracker key gives this endpoint a single shared budget
 * regardless of source.
 */
@Injectable()
export class GlobalWebhookThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(): Promise<string> {
    return 'whatsapp-webhook';
  }
}
