import { Test, TestingModule } from '@nestjs/testing';
import {
  HealthCheckService,
  HealthIndicatorService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { REDIS_CLIENT } from '../redis/redis.provider';

describe('HealthController', () => {
  let controller: HealthController;
  let health: { check: jest.Mock };
  let db: { pingCheck: jest.Mock };
  let healthIndicatorService: { check: jest.Mock };
  let redis: { ping: jest.Mock };

  beforeEach(async () => {
    health = {
      check: jest.fn((indicators: Array<() => unknown>) =>
        Promise.all(indicators.map((fn) => fn())),
      ),
    };
    db = {
      pingCheck: jest.fn().mockResolvedValue({ database: { status: 'up' } }),
    };
    redis = { ping: jest.fn().mockResolvedValue('PONG') };
    healthIndicatorService = {
      check: jest.fn(() => ({
        up: jest.fn((data?: object) => ({ redis: { status: 'up', ...data } })),
        down: jest.fn((data?: object) => ({
          redis: { status: 'down', ...data },
        })),
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: health },
        { provide: TypeOrmHealthIndicator, useValue: db },
        { provide: HealthIndicatorService, useValue: healthIndicatorService },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();

    controller = module.get(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('checks both the database and redis', async () => {
    await controller.check();

    expect(health.check).toHaveBeenCalledWith([
      expect.any(Function),
      expect.any(Function),
    ]);
    expect(db.pingCheck).toHaveBeenCalledWith('database');
    expect(redis.ping).toHaveBeenCalled();
  });

  it('reports redis as down when the ping fails, without throwing', async () => {
    redis.ping.mockRejectedValue(new Error('connection refused'));

    const results = await controller.check();

    expect(results[1]).toEqual({
      redis: { status: 'down', message: 'connection refused' },
    });
  });
});
