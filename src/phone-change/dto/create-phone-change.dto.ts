import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class CreatePhoneChangeDto {
    @ApiProperty({ example: '+382 69 999 999' })
    @IsString()
    @Matches(/^\+?[0-9\s\-()]{6,20}$/, {
        message: 'newPhoneNumber must be a valid phone number (digits and + - ( ) spaces only)',
    })
    newPhoneNumber: string;
}
