import { PartialType } from '@nestjs/swagger';
import { CreateResortContactDto } from './create-resort-contact.dto';

export class UpdateResortContactDto extends PartialType(
  CreateResortContactDto,
) {}
