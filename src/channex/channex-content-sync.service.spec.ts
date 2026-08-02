import { Test, TestingModule } from '@nestjs/testing';
import { BadGatewayException } from '@nestjs/common';
import { ChannexContentSyncService } from './channex-content-sync.service';
import { ChannexApiClient, ChannexApiError } from './channex-api.client';
import { Resort } from '../entity/resort.entity';
import { ResortFeature } from '../entity/resort-feature.entity';

describe('ChannexContentSyncService', () => {
  let service: ChannexContentSyncService;
  let channexApiClient: { get: jest.Mock; post: jest.Mock; put: jest.Mock };

  const resort = {
    id: 'resort-1',
    channexPropertyId: 'property-1',
    currency: 'USD',
  } as Resort;

  beforeEach(async () => {
    channexApiClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannexContentSyncService,
        { provide: ChannexApiClient, useValue: channexApiClient },
      ],
    }).compile();

    service = module.get<ChannexContentSyncService>(ChannexContentSyncService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('syncRoomType', () => {
    it('creates a new room type via POST when the feature has no channexRoomTypeId yet', async () => {
      const feature = {
        id: 'feature-1',
        name: 'Cabana',
        quantity: 3,
        capacity: 2,
        description: 'A nice cabana',
      } as ResortFeature;
      channexApiClient.post.mockResolvedValue({ id: 'new-room-type-1' });

      const result = await service.syncRoomType(resort, feature);

      const [path, body] = channexApiClient.post.mock.calls[0] as [
        string,
        { room_type: Record<string, unknown> },
      ];
      expect(path).toBe('/room_types');
      expect(body.room_type).toMatchObject({
        property_id: 'property-1',
        title: 'Cabana',
        count_of_rooms: 3,
        occ_adults: 2,
        content: { description: 'A nice cabana' },
      });
      expect(channexApiClient.put).not.toHaveBeenCalled();
      expect(result).toBe('new-room-type-1');
    });

    it('updates the existing room type via PUT when channexRoomTypeId is already set', async () => {
      const feature = {
        id: 'feature-1',
        name: 'Cabana',
        quantity: 3,
        capacity: 2,
        channexRoomTypeId: 'existing-room-type-1',
      } as ResortFeature;
      channexApiClient.put.mockResolvedValue({ id: 'existing-room-type-1' });

      const result = await service.syncRoomType(resort, feature);

      const [path, body] = channexApiClient.put.mock.calls[0] as [
        string,
        { room_type: Record<string, unknown> },
      ];
      expect(path).toBe('/room_types/existing-room-type-1');
      expect(body.room_type).toMatchObject({ title: 'Cabana' });
      expect(channexApiClient.post).not.toHaveBeenCalled();
      expect(result).toBe('existing-room-type-1');
    });

    it('wraps a ChannexApiError from the API client in a BadGatewayException', async () => {
      const feature = {
        id: 'feature-1',
        name: 'Cabana',
        quantity: 3,
        capacity: 2,
      } as ResortFeature;
      channexApiClient.post.mockRejectedValue(
        new ChannexApiError('validation failed', 422),
      );

      await expect(service.syncRoomType(resort, feature)).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('wraps a generic error from the API client in a BadGatewayException too', async () => {
      const feature = {
        id: 'feature-1',
        name: 'Cabana',
        quantity: 3,
        capacity: 2,
      } as ResortFeature;
      channexApiClient.post.mockRejectedValue(new Error('network down'));

      await expect(service.syncRoomType(resort, feature)).rejects.toThrow(
        BadGatewayException,
      );
    });
  });

  describe('syncRatePlan', () => {
    it('creates a new rate plan via POST when the feature has no channexRatePlanId yet', async () => {
      const feature = {
        id: 'feature-1',
        name: 'Cabana',
        capacity: 2,
        price: 100,
        channexRoomTypeId: 'room-type-1',
      } as ResortFeature;
      channexApiClient.post.mockResolvedValue({ id: 'new-rate-plan-1' });

      const result = await service.syncRatePlan(resort, feature);

      const [path, body] = channexApiClient.post.mock.calls[0] as [
        string,
        { rate_plan: Record<string, unknown> },
      ];
      expect(path).toBe('/rate_plans');
      expect(body.rate_plan).toMatchObject({
        property_id: 'property-1',
        room_type_id: 'room-type-1',
        currency: 'USD',
      });
      expect(channexApiClient.put).not.toHaveBeenCalled();
      expect(result).toBe('new-rate-plan-1');
    });

    it('updates the existing rate plan via PUT when channexRatePlanId is already set', async () => {
      const feature = {
        id: 'feature-1',
        name: 'Cabana',
        capacity: 2,
        price: 100,
        channexRoomTypeId: 'room-type-1',
        channexRatePlanId: 'existing-rate-plan-1',
      } as ResortFeature;
      channexApiClient.put.mockResolvedValue({ id: 'existing-rate-plan-1' });

      const result = await service.syncRatePlan(resort, feature);

      const [path, body] = channexApiClient.put.mock.calls[0] as [
        string,
        { rate_plan: Record<string, unknown> },
      ];
      expect(path).toBe('/rate_plans/existing-rate-plan-1');
      expect(body.rate_plan).toMatchObject({ room_type_id: 'room-type-1' });
      expect(channexApiClient.post).not.toHaveBeenCalled();
      expect(result).toBe('existing-rate-plan-1');
    });

    it('wraps a ChannexApiError from the API client in a BadGatewayException', async () => {
      const feature = {
        id: 'feature-1',
        name: 'Cabana',
        capacity: 2,
        price: 100,
        channexRoomTypeId: 'room-type-1',
      } as ResortFeature;
      channexApiClient.post.mockRejectedValue(
        new ChannexApiError('validation failed', 422),
      );

      await expect(service.syncRatePlan(resort, feature)).rejects.toThrow(
        BadGatewayException,
      );
    });
  });

  describe('syncFeatureContent', () => {
    it('syncs the room type first, then the rate plan, mutating the feature with both returned ids', async () => {
      const feature = {
        id: 'feature-1',
        name: 'Cabana',
        quantity: 3,
        capacity: 2,
        price: 100,
      } as ResortFeature;
      channexApiClient.post
        .mockResolvedValueOnce({ id: 'room-type-1' })
        .mockResolvedValueOnce({ id: 'rate-plan-1' });

      await service.syncFeatureContent(resort, feature);

      expect(feature.channexRoomTypeId).toBe('room-type-1');
      expect(feature.channexRatePlanId).toBe('rate-plan-1');
      // The rate plan call must see the room type id syncRoomType just set.
      const [ratePlanPath, ratePlanBody] = channexApiClient.post.mock
        .calls[1] as [string, { rate_plan: Record<string, unknown> }];
      expect(ratePlanPath).toBe('/rate_plans');
      expect(ratePlanBody.rate_plan).toMatchObject({
        room_type_id: 'room-type-1',
      });
    });
  });
});
