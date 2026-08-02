import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { getLoggerToken } from 'nestjs-pino';
import { ChannexAriProducer, CHANNEX_ARI_QUEUE } from './channex-ari.producer';

describe('ChannexAriProducer', () => {
  let producer: ChannexAriProducer;
  let queue: { getJob: jest.Mock; add: jest.Mock };
  let logger: { error: jest.Mock };

  beforeEach(async () => {
    queue = {
      getJob: jest.fn().mockResolvedValue(undefined),
      add: jest.fn().mockResolvedValue(undefined),
    };
    logger = { error: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannexAriProducer,
        { provide: getQueueToken(CHANNEX_ARI_QUEUE), useValue: queue },
        { provide: getLoggerToken(ChannexAriProducer.name), useValue: logger },
      ],
    }).compile();

    producer = module.get<ChannexAriProducer>(ChannexAriProducer);
  });

  it('enqueues a fresh debounced job when none exists yet', async () => {
    await producer.enqueueAvailabilityPush('feature-1');

    expect(queue.getJob).toHaveBeenCalledWith(
      'channex-ari:availability:feature-1',
    );
    expect(queue.add).toHaveBeenCalledWith(
      'availability',
      { featureId: 'feature-1', kind: 'availability' },
      expect.objectContaining({ jobId: 'channex-ari:availability:feature-1' }),
    );
  });

  it.each(['delayed', 'waiting', 'completed', 'failed'] as const)(
    'removes a %s job under the same id before re-enqueuing, so the new push actually gets scheduled',
    async (state) => {
      // Regression test: BullMQ silently no-ops `add()` when a job with the
      // same jobId already exists in ANY state. A job left over from a
      // permanently-failed push (retries exhausted) used to block every
      // subsequent debounced push for that feature+kind forever, since only
      // 'delayed'/'waiting' were being cleared.
      const existingJob = {
        getState: jest.fn().mockResolvedValue(state),
        remove: jest.fn().mockResolvedValue(undefined),
      };
      queue.getJob.mockResolvedValue(existingJob);

      await producer.enqueueRestrictionsPush('feature-2');

      expect(existingJob.remove).toHaveBeenCalled();
      expect(queue.add).toHaveBeenCalledWith(
        'restrictions',
        { featureId: 'feature-2', kind: 'restrictions' },
        expect.objectContaining({
          jobId: 'channex-ari:restrictions:feature-2',
        }),
      );
    },
  );

  it('leaves an active (currently executing) job alone instead of removing it', async () => {
    const existingJob = {
      getState: jest.fn().mockResolvedValue('active'),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    queue.getJob.mockResolvedValue(existingJob);

    await producer.enqueueAvailabilityPush('feature-3');

    expect(existingJob.remove).not.toHaveBeenCalled();
  });

  it('never throws, even when the queue itself fails', async () => {
    queue.getJob.mockRejectedValue(new Error('redis is down'));

    await expect(
      producer.enqueueAvailabilityPush('feature-4'),
    ).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });
});
