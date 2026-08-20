import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { RatePeriod } from '../../entity/rate-period.entity';

export class RatePeriodResponseDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  name: string;

  @ApiProperty()
  @Expose()
  startDate: string;

  @ApiProperty()
  @Expose()
  endDate: string;

  @ApiProperty()
  @Expose()
  price: number;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  minStay: number | null;

  @ApiProperty()
  @Expose()
  stopSell: boolean;

  @ApiProperty()
  @Expose()
  closedToArrival: boolean;

  @ApiProperty()
  @Expose()
  closedToDeparture: boolean;

  @ApiProperty()
  @Expose()
  priority: number;

  static fromEntity(period: RatePeriod): RatePeriodResponseDto {
    const dto = new RatePeriodResponseDto();
    dto.id = period.id;
    dto.name = period.name;
    dto.startDate = period.startDate;
    dto.endDate = period.endDate;
    dto.price = period.price;
    dto.minStay = period.minStay;
    dto.stopSell = period.stopSell;
    dto.closedToArrival = period.closedToArrival;
    dto.closedToDeparture = period.closedToDeparture;
    dto.priority = period.priority;
    return dto;
  }
}
