import { ApiProperty } from '@nestjs/swagger';

export class CreateResortDto {
    @ApiProperty({ example: 'Sunset Bay Resort' })
    name: string;

    @ApiProperty({ example: '1211777188687734' })
    phoneNumber: string;
}
