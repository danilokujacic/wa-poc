import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reservation } from '../entity/reservation.entity';
import { ResortFeature } from '../entity/resort-feature.entity';
import { ReservationRepository } from '../repository/reservation.repository';
import { ResortFeatureRepository } from '../repository/resort-feature.repository';
import { ReservationController } from './reservation.controller';
import { ReservationService } from './reservation.service';
import { ResortMemberGuard } from '../resort/guards/resort-member.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [TypeOrmModule.forFeature([Reservation, ResortFeature]), AuthModule],
    providers: [ReservationRepository, ResortFeatureRepository, ReservationService, ResortMemberGuard],
    exports: [ReservationRepository, ReservationService],
    controllers: [ReservationController],
})
export class ReservationModule { }
