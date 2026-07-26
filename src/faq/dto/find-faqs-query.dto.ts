import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export enum FaqSortableField {
    ID = 'id',
    QUESTION = 'question',
    ANSWER = 'answer',
}

export class FindFaqsQueryDto {
    @ApiPropertyOptional({ description: 'Case-insensitive search across question and answer' })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ enum: FaqSortableField, default: FaqSortableField.ID })
    @IsOptional()
    @IsIn(Object.values(FaqSortableField))
    sortBy?: FaqSortableField;

    @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'ASC' })
    @IsOptional()
    @IsIn(['ASC', 'DESC'])
    sortOrder?: 'ASC' | 'DESC';

    @ApiPropertyOptional({ default: 1, minimum: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number;

    @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number;
}
