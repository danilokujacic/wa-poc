import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class CreateResortDto {
  @ApiProperty({ example: 'Sunset Bay Resort' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: '1211777188687734' })
  @IsString()
  @Matches(/^\+?[0-9\s\-()]{6,20}$/, {
    message:
      'phoneNumber must be a valid phone number (digits and + - ( ) spaces only)',
  })
  phoneNumber: string;
}
