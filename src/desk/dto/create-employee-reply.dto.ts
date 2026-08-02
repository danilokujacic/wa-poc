import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class CreateEmployeeReplyDto {
  @ApiProperty({
    example: 'Thanks for reaching out — let me check on that for you.',
  })
  @IsString()
  @Length(1, 4096)
  body: string;
}
