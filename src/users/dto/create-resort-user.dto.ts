import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateResortUserDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  @MaxLength(255)
  email: string;

  // bcrypt silently truncates input past 72 bytes — cap here so validation
  // errors, not silent truncation, is what a too-long password hits.
  @ApiProperty({ example: 'super-secret-password' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}
