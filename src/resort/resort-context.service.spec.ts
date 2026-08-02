import { Test, TestingModule } from '@nestjs/testing';
import { getLoggerToken } from 'nestjs-pino';
import { ResortContextService } from './resort-context.service';
import { ResortRepository } from '../repository/resort.repository';
import { REDIS_CLIENT } from '../redis/redis.provider';

describe('ResortContextService', () => {
  let service: ResortContextService;
  let resortRepository: { findByPhoneNumberWithCore: jest.Mock };
  let redis: { get: jest.Mock; set: jest.Mock; expire: jest.Mock };
  let logger: {
    info: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
    debug: jest.Mock;
  };

  beforeEach(async () => {
    resortRepository = { findByPhoneNumberWithCore: jest.fn() };
    redis = { get: jest.fn(), set: jest.fn(), expire: jest.fn() };
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResortContextService,
        { provide: ResortRepository, useValue: resortRepository },
        { provide: REDIS_CLIENT, useValue: redis },
        {
          provide: getLoggerToken(ResortContextService.name),
          useValue: logger,
        },
      ],
    }).compile();

    service = module.get<ResortContextService>(ResortContextService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('get', () => {
    it('returns the cached resort and refreshes its TTL on a cache hit', async () => {
      const resort = { id: 'resort-1', name: 'Cached Resort' };
      redis.get.mockResolvedValue(JSON.stringify(resort));

      const result = await service.get('conv-1', 'phone-id-1');

      expect(redis.get).toHaveBeenCalledWith('wa:resort-context:conv-1');
      expect(redis.expire).toHaveBeenCalledWith(
        'wa:resort-context:conv-1',
        300,
      );
      expect(resortRepository.findByPhoneNumberWithCore).not.toHaveBeenCalled();
      expect(result).toEqual(resort);
    });

    it('fetches from the DB and caches it on a cache miss', async () => {
      redis.get.mockResolvedValue(null);
      const resort = { id: 'resort-1', name: 'DB Resort' };
      resortRepository.findByPhoneNumberWithCore.mockResolvedValue(resort);

      const result = await service.get('conv-1', 'phone-id-1');

      expect(resortRepository.findByPhoneNumberWithCore).toHaveBeenCalledWith(
        'phone-id-1',
      );
      expect(redis.set).toHaveBeenCalledWith(
        'wa:resort-context:conv-1',
        JSON.stringify(resort),
        'EX',
        300,
      );
      expect(result).toEqual(resort);
    });

    it('returns null and does not cache when the resort is not found in the DB', async () => {
      redis.get.mockResolvedValue(null);
      resortRepository.findByPhoneNumberWithCore.mockResolvedValue(null);

      const result = await service.get('conv-1', 'phone-id-1');

      expect(redis.set).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('warm', () => {
    it('delegates to get()', async () => {
      redis.get.mockResolvedValue(null);
      const resort = { id: 'resort-1' };
      resortRepository.findByPhoneNumberWithCore.mockResolvedValue(resort);

      await service.warm('conv-1', 'phone-id-1');

      expect(resortRepository.findByPhoneNumberWithCore).toHaveBeenCalledWith(
        'phone-id-1',
      );
    });

    it('never throws, even if get() fails, and logs the error instead', async () => {
      redis.get.mockRejectedValue(new Error('redis down'));

      await expect(
        service.warm('conv-1', 'phone-id-1'),
      ).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error warming resort context for conv-1'),
      );
    });
  });
});
