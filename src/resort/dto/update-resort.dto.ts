import { PartialType } from '@nestjs/swagger';
import { CreateResortDto } from './create-resort.dto';

export class UpdateResortDto extends PartialType(CreateResortDto) {}
