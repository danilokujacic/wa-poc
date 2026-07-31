import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { Resort } from '../entity/resort.entity';
import { ResortFeature } from '../entity/resort-feature.entity';
import { ChannexApiClient, ChannexApiError } from './channex-api.client';
import { toMinorUnits } from './channex-money.util';

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

interface ChannexRatePlanAttributes {
  property_id: string;
  room_type_id: string;
  title: string;
  currency: string;
  sell_mode: 'per_room';
  rate_mode: 'manual';
  options: Array<{ occupancy: number; is_primary: true; rate: number }>;
}

interface ChannexRatePlanResource {
  id: string;
}

@Injectable()
export class ChannexContentSyncService {
  private readonly logger = new Logger(ChannexContentSyncService.name);

  constructor(private readonly channexApiClient: ChannexApiClient) {}

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
      ...(feature.description
        ? { content: { description: feature.description } }
        : {}),
    };

    try {
      if (feature.channexRoomTypeId) {
        await this.channexApiClient.put<ChannexRoomTypeResource>(
          `/room_types/${feature.channexRoomTypeId}`,
          { room_type: attrs },
        );
        return feature.channexRoomTypeId;
      }

      const created = await this.channexApiClient.post<ChannexRoomTypeResource>(
        '/room_types',
        { room_type: attrs },
      );
      return created.id;
    } catch (err) {
      const reason =
        err instanceof ChannexApiError ? err.message : (err as Error).message;
      this.logger.error(
        `Failed to sync feature ${feature.id} to Channex: ${reason}`,
      );
      throw new BadGatewayException(
        `Failed to sync feature with Channex: ${reason}`,
      );
    }
  }

  /**
   * Upserts the rate plan carrying this feature's price. A feature maps to
   * exactly one rate plan (per_room, manual rate) — this app has no
   * seasonal/multi-tier pricing to justify more than one per feature.
   * Requires feature.channexRoomTypeId to already be set.
   */
  async syncRatePlan(resort: Resort, feature: ResortFeature): Promise<string> {
    const attrs: ChannexRatePlanAttributes = {
      property_id: resort.channexPropertyId as string,
      room_type_id: feature.channexRoomTypeId as string,
      title: feature.name,
      currency: resort.currency,
      sell_mode: 'per_room',
      rate_mode: 'manual',
      options: [
        {
          occupancy: feature.capacity,
          is_primary: true,
          rate: toMinorUnits(feature.price),
        },
      ],
    };

    try {
      if (feature.channexRatePlanId) {
        await this.channexApiClient.put<ChannexRatePlanResource>(
          `/rate_plans/${feature.channexRatePlanId}`,
          { rate_plan: attrs },
        );
        return feature.channexRatePlanId;
      }

      const created = await this.channexApiClient.post<ChannexRatePlanResource>(
        '/rate_plans',
        { rate_plan: attrs },
      );
      return created.id;
    } catch (err) {
      const reason =
        err instanceof ChannexApiError ? err.message : (err as Error).message;
      this.logger.error(
        `Failed to sync rate plan for feature ${feature.id} to Channex: ${reason}`,
      );
      throw new BadGatewayException(
        `Failed to sync rate plan with Channex: ${reason}`,
      );
    }
  }

  /**
   * Upserts a feature's room type and rate plan together — a rate plan
   * can't exist in Channex without its room type, so this is the entry
   * point callers should use instead of the two methods individually.
   */
  async syncFeatureContent(
    resort: Resort,
    feature: ResortFeature,
  ): Promise<void> {
    feature.channexRoomTypeId = await this.syncRoomType(resort, feature);
    feature.channexRatePlanId = await this.syncRatePlan(resort, feature);
  }
}
