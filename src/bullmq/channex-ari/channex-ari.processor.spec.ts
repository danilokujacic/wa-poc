import { Test, TestingModule } from '@nestjs/testing';
import { UnrecoverableError } from 'bullmq';
import { getLoggerToken } from 'nestjs-pino';
import { ChannexAriProcessor } from './channex-ari.processor';
import { ChannexAriService } from '../../channex/channex-ari.service';
import { ChannexApiError } from '../../channex/channex-api.client';

describe('ChannexAriProcessor', () => {
  let processor: ChannexAriProcessor;
  let channexAriService: {
    pushAvailability: jest.Mock;
    pushRestrictions: jest.Mock;
  };
  let logger: { warn: jest.Mock };

  beforeEach(async () => {
    channexAriService = {
      pushAvailability: jest.fn(),
      pushRestrictions: jest.fn(),
    };
    logger = { warn: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannexAriProcessor,
        { provide: ChannexAriService, useValue: channexAriService },
        {
          provide: getLoggerToken(ChannexAriProcessor.name),
          useValue: logger,
        },
      ],
    }).compile();

    processor = module.get<ChannexAriProcessor>(ChannexAriProcessor);
  });

  const jobFor = (kind: 'availability' | 'restrictions') =>
    ({ data: { featureId: 'feature-1', kind } }) as never;

  it('pushes availability for an availability job', async () => {
    channexAriService.pushAvailability.mockResolvedValue(undefined);

    await processor.process(jobFor('availability'));

    expect(channexAriService.pushAvailability).toHaveBeenCalledWith(
      'feature-1',
    );
    expect(channexAriService.pushRestrictions).not.toHaveBeenCalled();
  });

  it('pushes restrictions for a restrictions job', async () => {
    channexAriService.pushRestrictions.mockResolvedValue(undefined);

    await processor.process(jobFor('restrictions'));

    expect(channexAriService.pushRestrictions).toHaveBeenCalledWith(
      'feature-1',
    );
  });

  it('rethrows a transient error (5xx) so BullMQ retries', async () => {
    const err = new ChannexApiError('server blip', 503);
    channexAriService.pushAvailability.mockRejectedValue(err);

    await expect(processor.process(jobFor('availability'))).rejects.toBe(err);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('rethrows a network/unexpected error so BullMQ retries', async () => {
    const err = new TypeError('to.getTime is not a function');
    channexAriService.pushAvailability.mockRejectedValue(err);

    await expect(processor.process(jobFor('availability'))).rejects.toBe(err);
  });

  it('wraps a permanent error (4xx other than 429) as UnrecoverableError so BullMQ stops retrying', async () => {
    const err = new ChannexApiError('bad request', 422);
    channexAriService.pushRestrictions.mockRejectedValue(err);

    await expect(
      processor.process(jobFor('restrictions')),
    ).rejects.toBeInstanceOf(UnrecoverableError);
  });

  it('treats 429 as retryable, not permanent', async () => {
    const err = new ChannexApiError('rate limited', 429);
    channexAriService.pushAvailability.mockRejectedValue(err);

    await expect(processor.process(jobFor('availability'))).rejects.toBe(err);
  });
});
