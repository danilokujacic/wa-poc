import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { User, UserRole } from '../../entity/user.entity';
import { ResortResponseDto } from '../../resort/dto/resort-response.dto';

export class UserResponseDto {
    @ApiProperty()
    @Expose()
    id: string;

    @ApiProperty()
    @Expose()
    name: string;

    @ApiProperty()
    @Expose()
    email: string;

    @ApiProperty({ enum: UserRole })
    @Expose()
    role: UserRole;

    @ApiProperty()
    @Expose()
    emailConfirmed: boolean;

    @ApiProperty({ type: ResortResponseDto, nullable: true })
    @Expose()
    @Type(() => ResortResponseDto)
    resort: ResortResponseDto | null;

    static fromEntity(user: User): UserResponseDto {
        const dto = new UserResponseDto();
        dto.id = user.id;
        dto.name = user.name;
        dto.email = user.email;
        dto.role = user.role;
        dto.emailConfirmed = user.emailConfirmed;
        dto.resort = user.resort ? ResortResponseDto.fromEntity(user.resort) : null;
        return dto;
    }
}
