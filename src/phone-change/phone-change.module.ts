import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PhoneChange } from '../entity/phone-change.entity';
import { Resort } from '../entity/resort.entity';
import { PhoneChangeRepository } from '../repository/phone-change.repository';
import { ResortRepository } from '../repository/resort.repository';
import { PhoneChangeService } from './phone-change.service';
import { PhoneChangeController } from './phone-change.controller';
import { ResortOwnerGuard } from '../resort/guards/resort-owner.guard';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';

@Module({
    imports: [TypeOrmModule.forFeature([PhoneChange, Resort]), AuthModule, MailModule],
    providers: [PhoneChangeRepository, ResortRepository, PhoneChangeService, ResortOwnerGuard],
    controllers: [PhoneChangeController],
})
export class PhoneChangeModule { }
