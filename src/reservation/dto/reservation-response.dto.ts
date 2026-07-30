import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { Reservation, ReservationSource, ReservationStatus } from '../../entity/reservation.entity';
import { ResortFeatureResponseDto } from '../../resort-feature/dto/resort-feature-response.dto';

export class ReservationResponseDto {
    @ApiProperty()
    @Expose()
    id: string;

    @ApiProperty({ enum: ReservationStatus })
    @Expose()
    status: ReservationStatus;

    @ApiProperty()
    @Expose()
    startDate: Date;

    @ApiProperty()
    @Expose()
    endDate: Date;

    @ApiProperty()
    @Expose()
    phoneNumber: string;

    @ApiProperty()
    @Expose()
    adults: number;

    @ApiProperty()
    @Expose()
    kids: number;

    @ApiProperty({ required: false, nullable: true })
    @Expose()
    otherContact: unknown;

    @ApiProperty({ enum: ReservationSource })
    @Expose()
    source: ReservationSource;

    @ApiProperty({ required: false, nullable: true })
    @Expose()
    otaName: string | null;

    @ApiProperty({ required: false, nullable: true })
    @Expose()
    otaReservationCode: string | null;

    @ApiProperty()
    @Expose()
    createdAt: Date;

    @ApiProperty({ type: ResortFeatureResponseDto })
    @Expose()
    @Type(() => ResortFeatureResponseDto)
    feature: ResortFeatureResponseDto;

    static fromEntity(reservation: Reservation): ReservationResponseDto {
        const dto = new ReservationResponseDto();
        dto.id = reservation.id;
        dto.status = reservation.status;
        dto.startDate = reservation.startDate;
        dto.endDate = reservation.endDate;
        dto.phoneNumber = reservation.phoneNumber;
        dto.adults = reservation.adults;
        dto.kids = reservation.kids;
        dto.otherContact = reservation.otherContact;
        dto.source = reservation.source;
        dto.otaName = reservation.otaName;
        dto.otaReservationCode = reservation.otaReservationCode;
        dto.createdAt = reservation.createdAt;
        dto.feature = ResortFeatureResponseDto.fromEntity(reservation.feature);
        return dto;
    }
}
