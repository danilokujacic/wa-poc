import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.provider';

// Unauthenticated by design — this is what a load balancer / uptime monitor
// hits, and it deliberately reveals nothing beyond up/down per dependency.
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly healthIndicatorService: HealthIndicatorService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.checkRedis(),
    ]);
  }

  private async checkRedis() {
    const indicator = this.healthIndicatorService.check('redis');
    try {
      await this.redis.ping();
      return indicator.up();
    } catch (err) {
      return indicator.down({
        message: err instanceof Error ? err.message : 'unknown error',
      });
    }
  }
}
