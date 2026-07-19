import { PartialType } from '@nestjs/swagger';
import { CreateResortUserDto } from './create-resort-user.dto';

export class UpdateResortUserDto extends PartialType(CreateResortUserDto) { }
