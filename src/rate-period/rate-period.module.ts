import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RatePeriod } from '../entity/rate-period.entity';
import { ResortFeature } from '../entity/resort-feature.entity';
import { RatePeriodRepository } from '../repository/rate-period.repository';
import { ResortFeatureRepository } from '../repository/resort-feature.repository';
import { RatePeriodController } from './rate-period.controller';
import { RatePeriodService } from './rate-period.service';
import { ResortMemberGuard } from '../resort/guards/resort-member.guard';
import { ResortOwnerGuard } from '../resort/guards/resort-owner.guard';
import { AuthModule } from '../auth/auth.module';
import { ChannexAriModule } from '../channex/channex-ari.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RatePeriod, ResortFeature]),
    AuthModule,
    ChannexAriModule,
  ],
  providers: [
    RatePeriodRepository,
    ResortFeatureRepository,
    RatePeriodService,
    ResortMemberGuard,
    ResortOwnerGuard,
  ],
  controllers: [RatePeriodController],
  exports: [RatePeriodRepository],
})
export class RatePeriodModule {}
