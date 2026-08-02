import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class FindResortContactsQueryDto {
  @ApiPropertyOptional({
    description: 'Case-insensitive search across contact_name and contact',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
