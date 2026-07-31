import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reservation } from '../entity/reservation.entity';
import { ResortFeature } from '../entity/resort-feature.entity';
import { ReservationRepository } from '../repository/reservation.repository';
import { ResortFeatureRepository } from '../repository/resort-feature.repository';
import { ReservationController } from './reservation.controller';
import { ReservationService } from './reservation.service';
import { ReservationStatusScheduler } from './reservation-status.scheduler';
import { ResortMemberGuard } from '../resort/guards/resort-member.guard';
import { AuthModule } from '../auth/auth.module';
import { ChannexAriModule } from '../channex/channex-ari.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reservation, ResortFeature]),
    AuthModule,
    ChannexAriModule,
  ],
  providers: [
    ReservationRepository,
    ResortFeatureRepository,
    ReservationService,
    ResortMemberGuard,
    ReservationStatusScheduler,
  ],
  exports: [ReservationRepository, ReservationService],
  controllers: [ReservationController],
})
export class ReservationModule {}
