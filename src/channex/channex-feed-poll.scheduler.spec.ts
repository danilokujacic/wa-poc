import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ChannexFeedPollScheduler } from './channex-feed-poll.scheduler';
import { ChannexApiClient } from './channex-api.client';
import { ChannexBookingSyncService } from './channex-booking-sync.service';
import { ChannexBookingRevision } from './channex-booking-revision.interface';

describe('ChannexFeedPollScheduler', () => {
  let scheduler: ChannexFeedPollScheduler;
  let channexApiClient: { getWithMeta: jest.Mock; post: jest.Mock };
  let channexBookingSyncService: { applyRevision: jest.Mock };

  function revision(id: string): ChannexBookingRevision {
    return {
      id,
      attributes: {
        booking_id: `booking-${id}`,
        status: 'new',
        property_id: 'property-1',
      },
    };
  }

  beforeEach(async () => {
    channexApiClient = {
      getWithMeta: jest.fn(),
      post: jest.fn().mockResolvedValue(undefined),
    };
    channexBookingSyncService = {
      applyRevision: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannexFeedPollScheduler,
        { provide: ChannexApiClient, useValue: channexApiClient },
        {
          provide: ChannexBookingSyncService,
          useValue: channexBookingSyncService,
        },
      ],
    }).compile();

    scheduler = module.get<ChannexFeedPollScheduler>(ChannexFeedPollScheduler);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('stops after the first page when it returns zero revisions', async () => {
    channexApiClient.getWithMeta.mockResolvedValue({
      data: [],
      meta: undefined,
    });

    await scheduler.drainFeed();

    expect(channexApiClient.getWithMeta).toHaveBeenCalledTimes(1);
    expect(channexBookingSyncService.applyRevision).not.toHaveBeenCalled();
  });

  it('applies and acks every revision on a page, then stops when meta.total <= meta.limit', async () => {
    channexApiClient.getWithMeta.mockResolvedValue({
      data: [revision('r1'), revision('r2')],
      meta: { total: 2, limit: 100, page: 1 },
    });

    await scheduler.drainFeed();

    expect(channexApiClient.getWithMeta).toHaveBeenCalledTimes(1);
    expect(channexBookingSyncService.applyRevision).toHaveBeenCalledTimes(2);
    expect(channexApiClient.post).toHaveBeenCalledWith(
      '/booking_revisions/r1/ack',
    );
    expect(channexApiClient.post).toHaveBeenCalledWith(
      '/booking_revisions/r2/ack',
    );
  });

  it('stops when meta is absent even if revisions were returned', async () => {
    channexApiClient.getWithMeta.mockResolvedValue({
      data: [revision('r1')],
      meta: undefined,
    });

    await scheduler.drainFeed();

    expect(channexApiClient.getWithMeta).toHaveBeenCalledTimes(1);
    expect(channexBookingSyncService.applyRevision).toHaveBeenCalledTimes(1);
  });

  it('pages through the feed while meta.total exceeds meta.limit, stopping once a page is empty', async () => {
    channexApiClient.getWithMeta
      .mockResolvedValueOnce({
        data: [revision('r1')],
        meta: { total: 3, limit: 1, page: 1 },
      })
      .mockResolvedValueOnce({
        data: [revision('r2')],
        meta: { total: 3, limit: 1, page: 2 },
      })
      .mockResolvedValueOnce({
        data: [],
        meta: { total: 3, limit: 1, page: 3 },
      });

    await scheduler.drainFeed();

    expect(channexApiClient.getWithMeta).toHaveBeenCalledTimes(3);
    expect(channexBookingSyncService.applyRevision).toHaveBeenCalledTimes(2);
  });

  it('logs and continues past a revision that fails to apply, leaving it un-acked, without blocking the rest of the batch', async () => {
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    channexApiClient.getWithMeta.mockResolvedValue({
      data: [revision('r1'), revision('r2')],
      meta: { total: 2, limit: 100, page: 1 },
    });
    channexBookingSyncService.applyRevision.mockImplementation(
      (rev: ChannexBookingRevision) => {
        if (rev.id === 'r1') {
          return Promise.reject(new Error('boom'));
        }
        return Promise.resolve();
      },
    );

    await scheduler.drainFeed();

    expect(channexBookingSyncService.applyRevision).toHaveBeenCalledTimes(2);
    // r1 failed and must not be acked; r2 succeeded and must be.
    expect(channexApiClient.post).not.toHaveBeenCalledWith(
      '/booking_revisions/r1/ack',
    );
    expect(channexApiClient.post).toHaveBeenCalledWith(
      '/booking_revisions/r2/ack',
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to apply Channex revision r1'),
    );
  });

  it('caps at MAX_PAGES_PER_RUN pages', async () => {
    channexApiClient.getWithMeta.mockResolvedValue({
      data: [revision('r1')],
      meta: { total: 1000, limit: 1, page: 1 },
    });

    await scheduler.drainFeed();

    expect(channexApiClient.getWithMeta).toHaveBeenCalledTimes(100);
  });
});
