import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { ResortFeature } from '../../entity/resort-feature.entity';

export class ResortFeatureResponseDto {
    @ApiProperty()
    @Expose()
    id: string;

    @ApiProperty()
    @Expose()
    name: string;

    @ApiProperty({ required: false, nullable: true })
    @Expose()
    description: string | null;

    @ApiProperty()
    @Expose()
    price: number;

    @ApiProperty()
    @Expose()
    quantity: number;

    @ApiProperty()
    @Expose()
    capacity: number;

    @ApiProperty({ type: [String], required: false, nullable: true })
    @Expose()
    images: string[] | null;

    @ApiProperty()
    @Expose()
    isActive: boolean;

    static fromEntity(feature: ResortFeature): ResortFeatureResponseDto {
        const dto = new ResortFeatureResponseDto();
        dto.id = feature.id;
        dto.name = feature.name;
        dto.description = feature.description;
        dto.price = feature.price;
        dto.quantity = feature.quantity;
        dto.capacity = feature.capacity;
        dto.images = feature.images;
        dto.isActive = feature.isActive;
        return dto;
    }
}
