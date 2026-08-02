import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class CreateFaqDto {
  @ApiProperty({ example: 'Where is the resort located?' })
  @IsString()
  @Length(5, 500)
  question: string;

  @ApiProperty({
    example:
      'Sunset Bay Resort sits right on Paradise Beach in Budva, Montenegro.',
  })
  @IsString()
  @Length(1, 1000)
  answer: string;
}
