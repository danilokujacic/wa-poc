import { ApiProperty } from '@nestjs/swagger';
import { ReservationStatus } from '../../entity/reservation.entity';

export class CreateReservationDto {
    @ApiProperty({ example: 'b3f1c9de-1234-4a5b-8c3d-0987654321ab' })
    featureId: string;

    @ApiProperty({ example: '2026-08-01' })
    startDate: string;

    @ApiProperty({ example: '2026-08-03' })
    endDate: string;

    @ApiProperty({ example: '38269280401' })
    phoneNumber: string;

    @ApiProperty({ required: false, enum: ReservationStatus })
    status?: ReservationStatus;

    @ApiProperty({ required: false, example: { email: 'guest@example.com' } })
    otherContact?: unknown;
}
