import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  Length,
  Min,
} from 'class-validator';

export class CreateRatePeriodDto {
  @ApiProperty({ example: 'Summer 2026' })
  @Length(2, 55)
  name: string;

  @ApiProperty({ example: '2026-06-01' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2026-09-15' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ example: 199.0 })
  @IsNumber()
  @IsPositive()
  price: number;

  @ApiProperty({
    example: 3,
    required: false,
    nullable: true,
    description: 'Minimum consecutive nights required during this period',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  minStay?: number;

  @ApiProperty({ default: false, required: false })
  @IsOptional()
  @IsBoolean()
  stopSell?: boolean;

  @ApiProperty({ default: false, required: false })
  @IsOptional()
  @IsBoolean()
  closedToArrival?: boolean;

  @ApiProperty({ default: false, required: false })
  @IsOptional()
  @IsBoolean()
  closedToDeparture?: boolean;

  @ApiProperty({
    default: 0,
    required: false,
    description: 'Higher wins when this period overlaps another one',
  })
  @IsOptional()
  @IsInt()
  priority?: number;
}
