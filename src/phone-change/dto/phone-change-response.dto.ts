import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { PhoneChange } from '../../entity/phone-change.entity';

export class PhoneChangeResponseDto {
    @ApiProperty()
    @Expose()
    id: string;

    @ApiProperty()
    @Expose()
    oldPhoneNumber: string;

    @ApiProperty()
    @Expose()
    newPhoneNumber: string;

    @ApiProperty()
    @Expose()
    createdAt: Date;

    static fromEntity(entity: PhoneChange): PhoneChangeResponseDto {
        const dto = new PhoneChangeResponseDto();
        dto.id = entity.id;
        dto.oldPhoneNumber = entity.oldPhoneNumber;
        dto.newPhoneNumber = entity.newPhoneNumber;
        dto.createdAt = entity.createdAt;
        return dto;
    }
}
