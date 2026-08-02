import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { Resort } from '../../entity/resort.entity';

export class ResortResponseDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  name: string;

  @ApiProperty()
  @Expose()
  phoneNumber: string;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  address: string | null;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  latitude: number | null;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  longitude: number | null;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  startWorkingHours: string | null;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  endWorkingHours: string | null;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  website: string | null;

  static fromEntity(resort: Resort): ResortResponseDto {
    const dto = new ResortResponseDto();
    dto.id = resort.id;
    dto.name = resort.name;
    dto.phoneNumber = resort.phoneNumber;
    dto.address = resort.address;
    dto.latitude = resort.latitude;
    dto.longitude = resort.longitude;
    dto.startWorkingHours = resort.startWorkingHours;
    dto.endWorkingHours = resort.endWorkingHours;
    dto.website = resort.website;
    return dto;
  }
}
