import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, Length } from 'class-validator';
import { ContactType } from '../../entity/resort-contact.entity';
import { IsValidContactForType } from '../../common/validators/is-valid-contact-for-type.validator';

export class CreateResortContactDto {
    @ApiProperty({ example: 'Front Desk' })
    @IsString()
    @Length(2, 55)
    contact_name: string;

    @ApiProperty({ enum: ContactType, example: ContactType.PHONE })
    @IsEnum(ContactType)
    type: ContactType;

    @ApiProperty({ example: '+382 69 123 456' })
    @IsValidContactForType()
    contact: string;
}
