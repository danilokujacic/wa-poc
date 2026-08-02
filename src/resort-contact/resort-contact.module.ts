import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResortContact } from '../entity/resort-contact.entity';
import { ResortContactRepository } from '../repository/resort-contact.repository';
import { ResortContactController } from './resort-contact.controller';
import { ResortContactService } from './resort-contact.service';
import { ResortMemberGuard } from '../resort/guards/resort-member.guard';
import { ResortOwnerGuard } from '../resort/guards/resort-owner.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([ResortContact]), AuthModule],
  providers: [
    ResortContactRepository,
    ResortContactService,
    ResortMemberGuard,
    ResortOwnerGuard,
  ],
  exports: [ResortContactRepository],
  controllers: [ResortContactController],
})
export class ResortContactModule {}
