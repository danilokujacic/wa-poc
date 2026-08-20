import { PartialType } from '@nestjs/swagger';
import { CreateRatePeriodDto } from './create-rate-period.dto';

export class UpdateRatePeriodDto extends PartialType(CreateRatePeriodDto) {}
