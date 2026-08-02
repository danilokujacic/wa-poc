import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class FeatureAvailabilityResponseDto {
  @ApiProperty()
  @Expose()
  featureId: string;

  @ApiProperty()
  @Expose()
  name: string;

  @ApiProperty()
  @Expose()
  availability: number;

  static fromResult(result: {
    featureId: string;
    name: string;
    availability: number;
  }): FeatureAvailabilityResponseDto {
    const dto = new FeatureAvailabilityResponseDto();
    dto.featureId = result.featureId;
    dto.name = result.name;
    dto.availability = result.availability;
    return dto;
  }
}
