import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { Faq } from '../../entity/faq.entity';

export class FaqResponseDto {
    @ApiProperty()
    @Expose()
    id: number;

    @ApiProperty()
    @Expose()
    question: string;

    @ApiProperty()
    @Expose()
    answer: string;

    static fromEntity(faq: Faq): FaqResponseDto {
        const dto = new FaqResponseDto();
        dto.id = faq.id;
        dto.question = faq.question;
        dto.answer = faq.answer;
        return dto;
    }
}
