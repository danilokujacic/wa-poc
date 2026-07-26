import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { ContactType, ResortContact } from '../../entity/resort-contact.entity';

export class ResortContactResponseDto {
    @ApiProperty()
    @Expose()
    id: string;

    @ApiProperty()
    @Expose()
    contact_name: string;

    @ApiProperty({ enum: ContactType })
    @Expose()
    type: ContactType;

    @ApiProperty()
    @Expose()
    contact: string;

    static fromEntity(entity: ResortContact): ResortContactResponseDto {
        const dto = new ResortContactResponseDto();
        dto.id = entity.id;
        dto.contact_name = entity.contact_name;
        dto.type = entity.type;
        dto.contact = entity.contact;
        return dto;
    }
}
