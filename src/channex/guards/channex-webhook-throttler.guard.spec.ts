import { ChannexWebhookThrottlerGuard } from './channex-webhook-throttler.guard';

describe('ChannexWebhookThrottlerGuard', () => {
  it('always tracks under one fixed key, giving the endpoint a single shared rate-limit budget', async () => {
    const guard = Object.create(
      ChannexWebhookThrottlerGuard.prototype,
    ) as ChannexWebhookThrottlerGuard;

    // getTracker is protected; reach it the same way the throttler
    // storage internals would, without instantiating the full
    // ThrottlerGuard (which needs its own module wiring).
    const tracker = await (
      guard as unknown as { getTracker: (req: unknown) => Promise<string> }
    ).getTracker({});

    expect(tracker).toBe('channex-webhook');
  });
});
