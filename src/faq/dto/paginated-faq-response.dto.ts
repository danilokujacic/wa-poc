import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { PaginatedFaqs } from '../faq.service';
import { FaqResponseDto } from './faq-response.dto';

export class PaginatedFaqResponseDto {
    @ApiProperty({ type: [FaqResponseDto] })
    @Expose()
    @Type(() => FaqResponseDto)
    data: FaqResponseDto[];

    @ApiProperty()
    @Expose()
    total: number;

    @ApiProperty()
    @Expose()
    page: number;

    @ApiProperty()
    @Expose()
    limit: number;

    static fromResult(result: PaginatedFaqs): PaginatedFaqResponseDto {
        const dto = new PaginatedFaqResponseDto();
        dto.data = result.data.map((faq) => FaqResponseDto.fromEntity(faq));
        dto.total = result.total;
        dto.page = result.page;
        dto.limit = result.limit;
        return dto;
    }
}
