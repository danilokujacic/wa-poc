import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { Resort } from '../entity/resort.entity';
import { ResortFeature } from '../entity/resort-feature.entity';
import { ChannexApiClient, ChannexApiError } from './channex-api.client';

interface ChannexRoomTypeAttributes {
    property_id: string;
    title: string;
    count_of_rooms: number;
    occ_adults: number;
    occ_children: number;
    occ_infants: number;
    default_occupancy: number;
    room_kind: 'room' | 'dorm';
    content?: { description: string };
}

interface ChannexRoomTypeResource {
    id: string;
}

@Injectable()
export class ChannexContentSyncService {
    private readonly logger = new Logger(ChannexContentSyncService.name);

    constructor(private readonly channexApiClient: ChannexApiClient) { }

    /**
     * Upserts a resort feature as a Channex room type. Feature.capacity has no
     * adults/children split, so it's mapped entirely to occ_adults — the closest
     * fit without inventing a distinction the local model doesn't track.
     */
    async syncRoomType(resort: Resort, feature: ResortFeature): Promise<string> {
        const attrs: ChannexRoomTypeAttributes = {
            property_id: resort.channexPropertyId as string,
            title: feature.name,
            count_of_rooms: feature.quantity,
            occ_adults: feature.capacity,
            occ_children: 0,
            occ_infants: 0,
            default_occupancy: feature.capacity,
            room_kind: 'room',
            ...(feature.description ? { content: { description: feature.description } } : {}),
        };

        try {
            if (feature.channexRoomTypeId) {
                await this.channexApiClient.put<ChannexRoomTypeResource>(
                    `/room_types/${feature.channexRoomTypeId}`,
                    { room_type: attrs },
                );
                return feature.channexRoomTypeId;
            }

            const created = await this.channexApiClient.post<ChannexRoomTypeResource>('/room_types', { room_type: attrs });
            return created.id;
        } catch (err) {
            const reason = err instanceof ChannexApiError ? err.message : (err as Error).message;
            this.logger.error(`Failed to sync feature ${feature.id} to Channex: ${reason}`);
            throw new BadGatewayException(`Failed to sync feature with Channex: ${reason}`);
        }
    }
}
