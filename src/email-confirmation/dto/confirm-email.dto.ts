import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class ConfirmEmailDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-4789-a012-3456789abcde' })
  @IsString()
  @Length(1, 255)
  slug: string;

  @ApiProperty({
    example: '9f8e7d6c5b4a3928170695847362514003938291abcdef0123456789abcdef',
  })
  @IsString()
  @Length(1, 255)
  code: string;
}
