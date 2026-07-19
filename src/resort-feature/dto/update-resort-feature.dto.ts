import { PartialType } from '@nestjs/swagger';
import { CreateResortFeatureDto } from './create-resort-feature.dto';

export class UpdateResortFeatureDto extends PartialType(CreateResortFeatureDto) { }
