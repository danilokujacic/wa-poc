import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Resort } from '../entity/resort.entity';
import { User } from '../entity/user.entity';
import { ResortRepository } from '../repository/resort.repository';
import { UserRepository } from '../repository/user.repository';
import { ResortController } from './resort.controller';
import { ResortService } from './resort.service';
import { ResortOwnerGuard } from './guards/resort-owner.guard';
import { ResortMemberGuard } from './guards/resort-member.guard';
import { ResortContextService } from './resort-context.service';
import { AuthModule } from '../auth/auth.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [TypeOrmModule.forFeature([Resort, User]), AuthModule, RedisModule],
  providers: [
    ResortRepository,
    ResortService,
    UserRepository,
    ResortOwnerGuard,
    ResortMemberGuard,
    ResortContextService,
  ],
  exports: [ResortRepository, ResortContextService],
  controllers: [ResortController],
})
export class ResortModule {}
