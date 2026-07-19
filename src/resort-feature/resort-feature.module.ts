import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResortFeature } from '../entity/resort-feature.entity';
import { ResortFeatureRepository } from '../repository/resort-feature.repository';
import { ResortFeatureController } from './resort-feature.controller';
import { ResortFeatureService } from './resort-feature.service';
import { ResortMemberGuard } from '../resort/guards/resort-member.guard';
import { ResortOwnerGuard } from '../resort/guards/resort-owner.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [TypeOrmModule.forFeature([ResortFeature]), AuthModule],
    providers: [ResortFeatureRepository, ResortFeatureService, ResortMemberGuard, ResortOwnerGuard],
    exports: [ResortFeatureRepository],
    controllers: [ResortFeatureController],
})
export class ResortFeatureModule { }
