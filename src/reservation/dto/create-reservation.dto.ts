import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ReservationStatus } from '../../entity/reservation.entity';
import { IsTodayOrLater } from '../../common/validators/is-today-or-later.validator';

export class CreateReservationDto {
  @ApiProperty({ example: 'b3f1c9de-1234-4a5b-8c3d-0987654321ab' })
  @IsUUID()
  featureId: string;

  @ApiProperty({ example: '2026-08-01' })
  @IsDateString()
  @IsTodayOrLater()
  startDate: string;

  @ApiProperty({ example: '2026-08-03' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ example: '38269280401' })
  @IsString()
  phoneNumber: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  adults: number;

  @ApiProperty({ example: 0 })
  @IsInt()
  @Min(0)
  kids: number;

  @ApiProperty({ required: false, enum: ReservationStatus })
  @IsOptional()
  @IsIn(Object.values(ReservationStatus))
  status?: ReservationStatus;

  @ApiProperty({ required: false, example: { email: 'guest@example.com' } })
  @IsOptional()
  otherContact?: unknown;
}
