import { ApiProperty } from '@nestjs/swagger';

export class CreateFaqDto {
    @ApiProperty({ example: 'Where is the resort located?' })
    question: string;

    @ApiProperty({ example: 'Sunset Bay Resort sits right on Paradise Beach in Budva, Montenegro.' })
    answer: string;
}
