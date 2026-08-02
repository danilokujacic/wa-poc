import { Test, TestingModule } from '@nestjs/testing';
import { ChannexAriService } from './channex-ari.service';
import { ChannexApiClient } from './channex-api.client';
import { ResortFeatureRepository } from '../repository/resort-feature.repository';
import { ReservationRepository } from '../repository/reservation.repository';

describe('ChannexAriService', () => {
  let service: ChannexAriService;
  let channexApiClient: { post: jest.Mock };
  let resortFeatureRepository: { findOne: jest.Mock };
  let reservationRepository: { findActiveOverlapping: jest.Mock };

  beforeEach(async () => {
    channexApiClient = { post: jest.fn().mockResolvedValue(undefined) };
    resortFeatureRepository = { findOne: jest.fn() };
    reservationRepository = { findActiveOverlapping: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannexAriService,
        { provide: ChannexApiClient, useValue: channexApiClient },
        { provide: ResortFeatureRepository, useValue: resortFeatureRepository },
        { provide: ReservationRepository, useValue: reservationRepository },
      ],
    }).compile();

    service = module.get<ChannexAriService>(ChannexAriService);
  });

  it('pushes availability when reservation dates come back as plain date strings, as pg/TypeORM actually returns them', async () => {
    // Regression test: the `date`-typed reservation columns are declared as
    // `Date` on the entity, but node-postgres returns Postgres `date` values
    // as plain 'YYYY-MM-DD' strings at runtime. Doing Date arithmetic
    // directly on them (comparisons, .getTime()) used to throw
    // "TypeError: to.getTime is not a function" the first time this ran
    // against a real reservation from the DB.
    resortFeatureRepository.findOne.mockResolvedValue({
      id: 'feature-1',
      quantity: 5,
      channexRoomTypeId: 'room-type-1',
      resort: { channexPropertyId: 'property-1' },
    });

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const checkin = new Date(today);
    checkin.setUTCDate(checkin.getUTCDate() + 1);
    const checkout = new Date(today);
    checkout.setUTCDate(checkout.getUTCDate() + 3);
    const toDateString = (d: Date) => d.toISOString().slice(0, 10);

    reservationRepository.findActiveOverlapping.mockResolvedValue([
      {
        startDate: toDateString(checkin) as unknown as Date,
        endDate: toDateString(checkout) as unknown as Date,
      },
    ]);

    await expect(service.pushAvailability('feature-1')).resolves.not.toThrow();

    expect(channexApiClient.post).toHaveBeenCalledTimes(1);
    const [path, body] = channexApiClient.post.mock.calls[0] as [
      string,
      { values: Array<{ room_type_id: string; availability: number }> },
    ];
    expect(path).toBe('/availability');
    expect(body.values).toContainEqual(
      expect.objectContaining({ room_type_id: 'room-type-1', availability: 4 }),
    );
  });

  describe('pushAvailability', () => {
    it('does nothing when the feature does not exist', async () => {
      resortFeatureRepository.findOne.mockResolvedValue(null);

      await expect(
        service.pushAvailability('missing-feature'),
      ).resolves.not.toThrow();

      expect(
        reservationRepository.findActiveOverlapping,
      ).not.toHaveBeenCalled();
      expect(channexApiClient.post).not.toHaveBeenCalled();
    });

    it('does nothing when the feature is not yet mapped to a Channex property', async () => {
      resortFeatureRepository.findOne.mockResolvedValue({
        id: 'feature-1',
        quantity: 5,
        channexRoomTypeId: 'room-type-1',
        resort: { channexPropertyId: null },
      });

      await service.pushAvailability('feature-1');

      expect(
        reservationRepository.findActiveOverlapping,
      ).not.toHaveBeenCalled();
      expect(channexApiClient.post).not.toHaveBeenCalled();
    });

    it('does nothing when the feature is not yet mapped to a Channex room type', async () => {
      resortFeatureRepository.findOne.mockResolvedValue({
        id: 'feature-1',
        quantity: 5,
        channexRoomTypeId: null,
        resort: { channexPropertyId: 'property-1' },
      });

      await service.pushAvailability('feature-1');

      expect(
        reservationRepository.findActiveOverlapping,
      ).not.toHaveBeenCalled();
      expect(channexApiClient.post).not.toHaveBeenCalled();
    });

    it('never reports negative availability when reservations overbook the feature quantity', async () => {
      resortFeatureRepository.findOne.mockResolvedValue({
        id: 'feature-1',
        quantity: 1,
        channexRoomTypeId: 'room-type-1',
        resort: { channexPropertyId: 'property-1' },
      });

      const windowStart = new Date();
      windowStart.setUTCHours(0, 0, 0, 0);
      const toDateString = (d: Date) => d.toISOString().slice(0, 10);
      const checkin = new Date(windowStart);
      const checkout = new Date(windowStart);
      checkout.setUTCDate(checkout.getUTCDate() + 2);

      // Two overlapping reservations against a feature with quantity 1 —
      // occupied count (2) exceeds quantity, so availability must clamp to 0
      // rather than go negative.
      reservationRepository.findActiveOverlapping.mockResolvedValue([
        { startDate: toDateString(checkin), endDate: toDateString(checkout) },
        { startDate: toDateString(checkin), endDate: toDateString(checkout) },
      ]);

      await service.pushAvailability('feature-1');

      const [, body] = channexApiClient.post.mock.calls[0] as [
        string,
        { values: Array<{ availability: number }> },
      ];
      expect(body.values.every((v) => v.availability >= 0)).toBe(true);
      expect(body.values).toContainEqual(
        expect.objectContaining({ availability: 0 }),
      );
    });
  });

  describe('pushRestrictions', () => {
    it('does nothing when the feature does not exist', async () => {
      resortFeatureRepository.findOne.mockResolvedValue(null);

      await expect(
        service.pushRestrictions('missing-feature'),
      ).resolves.not.toThrow();

      expect(channexApiClient.post).not.toHaveBeenCalled();
    });

    it('does nothing when the feature is not yet mapped to a Channex property', async () => {
      resortFeatureRepository.findOne.mockResolvedValue({
        id: 'feature-1',
        price: 49.99,
        channexRatePlanId: 'rate-plan-1',
        resort: { channexPropertyId: null },
      });

      await service.pushRestrictions('feature-1');

      expect(channexApiClient.post).not.toHaveBeenCalled();
    });

    it('does nothing when the feature is not yet mapped to a Channex rate plan', async () => {
      resortFeatureRepository.findOne.mockResolvedValue({
        id: 'feature-1',
        price: 49.99,
        channexRatePlanId: null,
        resort: { channexPropertyId: 'property-1' },
      });

      await service.pushRestrictions('feature-1');

      expect(channexApiClient.post).not.toHaveBeenCalled();
    });

    it('pushes the rate converted to minor units for the mapped rate plan', async () => {
      resortFeatureRepository.findOne.mockResolvedValue({
        id: 'feature-1',
        price: 49.99,
        channexRatePlanId: 'rate-plan-1',
        resort: { channexPropertyId: 'property-1' },
      });

      await service.pushRestrictions('feature-1');

      expect(resortFeatureRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'feature-1' },
        relations: { resort: true },
      });
      expect(channexApiClient.post).toHaveBeenCalledTimes(1);
      const [path, body] = channexApiClient.post.mock.calls[0] as [
        string,
        {
          values: Array<{
            property_id: string;
            rate_plan_id: string;
            rate: number;
          }>;
        },
      ];
      expect(path).toBe('/restrictions');
      expect(body.values).toEqual([
        expect.objectContaining({
          property_id: 'property-1',
          rate_plan_id: 'rate-plan-1',
          rate: 4999,
        }),
      ]);
    });
  });
});
