import { ApiProperty } from '@nestjs/swagger';

export class CreateResortUserDto {
    @ApiProperty({ example: 'Jane Doe' })
    name: string;

    @ApiProperty({ example: 'jane@example.com' })
    email: string;

    @ApiProperty({ example: 'super-secret-password' })
    password: string;
}
