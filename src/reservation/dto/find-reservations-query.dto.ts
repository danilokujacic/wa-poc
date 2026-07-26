import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import { ReservationStatus } from '../../entity/reservation.entity';

export class FindReservationsQueryDto {
    @ApiPropertyOptional({ description: 'Start date filter (ISO string)' })
    @IsOptional()
    @IsDateString()
    from?: string;

    @ApiPropertyOptional({ description: 'End date filter (ISO string)' })
    @IsOptional()
    @IsDateString()
    to?: string;

    @ApiPropertyOptional({ enum: [...Object.values(ReservationStatus), 'ALL'] })
    @IsOptional()
    @IsIn([...Object.values(ReservationStatus), 'ALL'])
    status?: ReservationStatus | 'ALL';

    @ApiPropertyOptional({ description: 'Filter by phone number (partial match)' })
    @IsOptional()
    @IsString()
    phoneNumber?: string;
}
