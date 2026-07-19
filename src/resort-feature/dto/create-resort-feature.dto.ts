import { ApiProperty } from '@nestjs/swagger';

export class CreateResortFeatureDto {
    @ApiProperty({ example: 'Private Cabana' })
    name: string;

    @ApiProperty({ example: 'A private beachfront cabana for two.', required: false })
    description?: string;

    @ApiProperty({ example: 49.99 })
    price: number;

    @ApiProperty({ example: 5 })
    quantity: number;

    @ApiProperty({
        example: ['https://bucket.example.com/cabana-1.jpg'],
        required: false,
        type: [String],
    })
    images?: string[];
}
