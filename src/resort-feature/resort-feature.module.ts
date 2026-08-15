import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResortFeature } from '../entity/resort-feature.entity';
import { Reservation } from '../entity/reservation.entity';
import { ResortFeatureRepository } from '../repository/resort-feature.repository';
import { ReservationRepository } from '../repository/reservation.repository';
import { ResortFeatureController } from './resort-feature.controller';
import { ResortFeatureService } from './resort-feature.service';
import { ResortMemberGuard } from '../resort/guards/resort-member.guard';
import { ResortOwnerGuard } from '../resort/guards/resort-owner.guard';
import { AuthModule } from '../auth/auth.module';
import { ChannexModule } from '../channex/channex.module';
import { ChannexAriModule } from '../channex/channex-ari.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ResortFeature, Reservation]),
    AuthModule,
    ChannexModule,
    ChannexAriModule,
    StorageModule,
  ],
  providers: [
    ResortFeatureRepository,
    ReservationRepository,
    ResortFeatureService,
    ResortMemberGuard,
    ResortOwnerGuard,
  ],
  exports: [ResortFeatureRepository],
  controllers: [ResortFeatureController],
})
export class ResortFeatureModule {}
