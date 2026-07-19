import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
    @ApiProperty({ example: 'jane@example.com' })
    email: string;

    @ApiProperty({ example: 'super-secret-password' })
    password: string;
}
