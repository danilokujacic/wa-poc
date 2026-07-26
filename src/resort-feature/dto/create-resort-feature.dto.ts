import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsPositive, IsString, Length, Matches } from 'class-validator';

export class CreateResortFeatureDto {
    @ApiProperty({ example: 'Private Cabana' })
    @IsString()
    @Length(2, 55)
    @Matches(/^[A-Za-z0-9 ,.|+_]+$/, {
        message: 'name may only contain letters, numbers, spaces, and , . | + _',
    })
    name: string;

    @ApiProperty({ example: 'A private beachfront cabana for two.', required: false })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ example: 49.99 })
    @IsNumber()
    @IsPositive()
    price: number;

    @ApiProperty({ example: 5 })
    @IsInt()
    @IsPositive()
    quantity: number;

    @ApiProperty({ example: 2, description: 'Number of guests this feature can accommodate' })
    @IsInt()
    @IsPositive()
    capacity: number;

    @ApiProperty({
        example: ['https://bucket.example.com/cabana-1.jpg'],
        required: false,
        type: [String],
        description: 'Uploaded as multipart form data, not JSON strings — not validated as part of this body',
    })
    @IsOptional()
    images?: string[];
}
