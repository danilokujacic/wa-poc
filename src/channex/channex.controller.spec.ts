import { Logger } from '@nestjs/common';
import { ChannexController } from './channex.controller';
import { ChannexBookingSyncService } from './channex-booking-sync.service';
import { ChannexWebhookPayload } from './channex-booking-revision.interface';

describe('ChannexController', () => {
  let controller: ChannexController;
  let channexBookingSyncService: { applyAndAckRevision: jest.Mock };

  // Instantiated directly rather than through Test.createTestingModule: the
  // route carries @UseGuards(ChannexWebhookGuard, ChannexWebhookThrottlerGuard),
  // and compiling a testing module that registers the controller pulls those
  // guards (and their own ConfigService/Reflector deps) into the DI graph too
  // — unnecessary ceremony for a handler this direct.
  beforeEach(() => {
    channexBookingSyncService = {
      applyAndAckRevision: jest.fn().mockResolvedValue(undefined),
    };

    controller = new ChannexController(
      channexBookingSyncService as unknown as ChannexBookingSyncService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function payload(revisionId?: string): ChannexWebhookPayload {
    return {
      event: 'booking_revision',
      payload: {
        booking_id: 'booking-1',
        property_id: 'property-1',
        revision_id: revisionId as string,
      },
    };
  }

  it('acks immediately and triggers async processing for a valid payload', () => {
    const body = payload('revision-1');

    const result = controller.handleWebhook(body);

    expect(result).toEqual({ received: true });
    expect(channexBookingSyncService.applyAndAckRevision).toHaveBeenCalledWith(
      'revision-1',
    );
  });

  it('logs a warning and returns early without calling the service when revision_id is missing', () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const body = payload(undefined);

    const result = controller.handleWebhook(body);

    expect(result).toEqual({ received: true });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('no revision_id'),
    );
    expect(
      channexBookingSyncService.applyAndAckRevision,
    ).not.toHaveBeenCalled();
  });

  it('catches and logs a rejected service promise without throwing out of the handler', async () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    channexBookingSyncService.applyAndAckRevision.mockRejectedValue(
      new Error('boom'),
    );
    const body = payload('revision-1');

    const result = controller.handleWebhook(body);

    expect(result).toEqual({ received: true });
    // Let the fire-and-forget promise's rejection handler run.
    await new Promise((resolve) => setImmediate(resolve));

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to process Channex revision revision-1'),
    );
  });
});
