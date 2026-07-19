import { ApiProperty } from '@nestjs/swagger';
import { ContactType } from '../../entity/resort-contact.entity';

export class CreateResortContactDto {
    @ApiProperty({ example: 'Front Desk' })
    contact_name: string;

    @ApiProperty({ enum: ContactType, example: ContactType.PHONE })
    type: ContactType;

    @ApiProperty({ example: '+382 69 123 456' })
    contact: string;
}
