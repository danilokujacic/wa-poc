import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Faq } from '../entity/faq.entity';
import { FaqRepository } from '../repository/faq.repository';
import { FaqController } from './faq.controller';
import { FaqService } from './faq.service';
import { ResortMemberGuard } from '../resort/guards/resort-member.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [TypeOrmModule.forFeature([Faq]), AuthModule],
    providers: [FaqRepository, FaqService, ResortMemberGuard],
    exports: [FaqRepository],
    controllers: [FaqController],
})
export class FaqModule { }
