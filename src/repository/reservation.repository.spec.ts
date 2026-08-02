import { ReservationRepository } from './reservation.repository';
import {
  ACTIVE_RESERVATION_STATUSES,
  ReservationStatus,
} from '../entity/reservation.entity';

function createRepository(): ReservationRepository {
  return new ReservationRepository({
    createEntityManager: () => ({}),
  } as any);
}

// expect.objectContaining(...) is typed `any` by @types/jest, so assigning
// it straight into a where-clause property (which has a concrete FindOperator
// union type) trips no-unsafe-assignment. Casting through `unknown` at the
// point of use keeps the FindOperator shape assertions (see the
// list-filter-pattern convention notes on asserting TypeORM operators) while
// keeping these spec files lint-clean.
function statusOperator(value: unknown): ReservationStatus {
  return value as ReservationStatus;
}

function dateOperator(value: unknown): Date {
  return value as Date;
}

interface FakeQueryBuilder {
  innerJoin: jest.Mock;
  select: jest.Mock;
  addSelect: jest.Mock;
  where: jest.Mock;
  andWhere: jest.Mock;
  groupBy: jest.Mock;
  getRawMany: jest.Mock;
  update: jest.Mock;
  set: jest.Mock;
  returning: jest.Mock;
  execute: jest.Mock;
}

function createQueryBuilderMock(): FakeQueryBuilder {
  const qb: FakeQueryBuilder = {
    innerJoin: jest.fn(),
    select: jest.fn(),
    addSelect: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    groupBy: jest.fn(),
    getRawMany: jest.fn(),
    update: jest.fn(),
    set: jest.fn(),
    returning: jest.fn(),
    execute: jest.fn(),
  };
  // Every chainable builder method returns the builder itself, matching
  // TypeORM's SelectQueryBuilder fluent API.
  qb.innerJoin.mockReturnValue(qb);
  qb.select.mockReturnValue(qb);
  qb.addSelect.mockReturnValue(qb);
  qb.where.mockReturnValue(qb);
  qb.andWhere.mockReturnValue(qb);
  qb.groupBy.mockReturnValue(qb);
  qb.update.mockReturnValue(qb);
  qb.set.mockReturnValue(qb);
  qb.returning.mockReturnValue(qb);
  return qb;
}

function mockCreateQueryBuilder(
  repository: ReservationRepository,
  qb: FakeQueryBuilder,
): jest.SpyInstance {
  return jest
    .spyOn(repository, 'createQueryBuilder')
    .mockReturnValue(
      qb as unknown as ReturnType<ReservationRepository['createQueryBuilder']>,
    );
}

describe('ReservationRepository', () => {
  let repository: ReservationRepository;

  beforeEach(() => {
    repository = createRepository();
  });

  describe('countActiveForFeature', () => {
    it('counts active reservations scoped to a feature', async () => {
      const countSpy = jest.spyOn(repository, 'count').mockResolvedValue(3);

      const result = await repository.countActiveForFeature('feature-1');

      expect(countSpy).toHaveBeenCalledWith({
        where: {
          feature: { id: 'feature-1' },
          status: statusOperator(
            expect.objectContaining({
              _type: 'in',
              _value: ACTIVE_RESERVATION_STATUSES,
            }),
          ),
        },
      });
      expect(result).toBe(3);
    });
  });

  describe('countActiveForFeatures', () => {
    it('returns an empty map without querying when given no feature ids', async () => {
      const qbSpy = jest.spyOn(repository, 'createQueryBuilder');

      const result = await repository.countActiveForFeatures([]);

      expect(qbSpy).not.toHaveBeenCalled();
      expect(result).toEqual(new Map());
    });

    it('builds a grouped count query and maps feature id to count', async () => {
      const qb = createQueryBuilderMock();
      qb.getRawMany.mockResolvedValue([
        { featureId: 'feature-1', count: '2' },
        { featureId: 'feature-2', count: '5' },
      ]);
      mockCreateQueryBuilder(repository, qb);

      const result = await repository.countActiveForFeatures([
        'feature-1',
        'feature-2',
      ]);

      expect(qb.innerJoin).toHaveBeenCalledWith(
        'reservation.feature',
        'feature',
      );
      expect(qb.select).toHaveBeenCalledWith('feature.id', 'featureId');
      expect(qb.addSelect).toHaveBeenCalledWith(
        'COUNT(reservation.id)',
        'count',
      );
      expect(qb.where).toHaveBeenCalledWith('feature.id IN (:...featureIds)', {
        featureIds: ['feature-1', 'feature-2'],
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'reservation.status IN (:...statuses)',
        {
          statuses: ACTIVE_RESERVATION_STATUSES,
        },
      );
      expect(qb.groupBy).toHaveBeenCalledWith('feature.id');
      expect(result).toEqual(
        new Map([
          ['feature-1', 2],
          ['feature-2', 5],
        ]),
      );
    });
  });

  describe('findActiveOverlapping', () => {
    it('finds active reservations overlapping the given date range', async () => {
      const from = new Date('2026-08-01T00:00:00.000Z');
      const to = new Date('2026-08-05T00:00:00.000Z');
      const reservations = [{ id: 'res-1' }];
      const findSpy = jest
        .spyOn(repository, 'find')
        .mockResolvedValue(reservations as any);

      const result = await repository.findActiveOverlapping(
        'feature-1',
        from,
        to,
      );

      expect(findSpy).toHaveBeenCalledWith({
        where: {
          feature: { id: 'feature-1' },
          status: statusOperator(
            expect.objectContaining({
              _type: 'in',
              _value: ACTIVE_RESERVATION_STATUSES,
            }),
          ),
          startDate: dateOperator(
            expect.objectContaining({ _type: 'lessThan', _value: to }),
          ),
          endDate: dateOperator(
            expect.objectContaining({ _type: 'moreThan', _value: from }),
          ),
        },
      });
      expect(result).toBe(reservations);
    });
  });

  describe('findLatestPendingForGuest', () => {
    it('finds the latest pending reservation for a guest at a resort', async () => {
      const reservation = { id: 'res-1' };
      const findOneSpy = jest
        .spyOn(repository, 'findOne')
        .mockResolvedValue(reservation as any);

      const result = await repository.findLatestPendingForGuest(
        'resort-1',
        '+123',
      );

      expect(findOneSpy).toHaveBeenCalledWith({
        where: {
          phoneNumber: '+123',
          status: ReservationStatus.PENDING,
          feature: { resort: { id: 'resort-1' } },
        },
        relations: { feature: true },
        order: { createdAt: 'DESC' },
      });
      expect(result).toBe(reservation);
    });
  });

  describe('declineStalePending', () => {
    it('declines stale pending reservations and returns distinct affected feature ids', async () => {
      const qb = createQueryBuilderMock();
      qb.execute.mockResolvedValue({
        raw: [
          { featureId: 'feature-1' },
          { featureId: 'feature-1' },
          { featureId: 'feature-2' },
        ],
      });
      mockCreateQueryBuilder(repository, qb);
      const cutoff = new Date('2026-08-01T00:00:00.000Z');

      const result = await repository.declineStalePending(cutoff);

      expect(qb.update).toHaveBeenCalled();
      expect(qb.set).toHaveBeenCalledWith({
        status: ReservationStatus.DECLINED,
      });
      expect(qb.where).toHaveBeenCalledWith('status = :status', {
        status: ReservationStatus.PENDING,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('"startDate" >= :cutoff', {
        cutoff,
      });
      expect(qb.returning).toHaveBeenCalledWith('"featureId"');
      expect(result).toEqual(['feature-1', 'feature-2']);
    });
  });

  describe('declinePendingForFeature', () => {
    it('declines pending reservations for a feature and returns the affected count', async () => {
      const updateSpy = jest
        .spyOn(repository, 'update')
        .mockResolvedValue({ affected: 4 } as any);

      const result = await repository.declinePendingForFeature('feature-1');

      expect(updateSpy).toHaveBeenCalledWith(
        { feature: { id: 'feature-1' }, status: ReservationStatus.PENDING },
        { status: ReservationStatus.DECLINED },
      );
      expect(result).toBe(4);
    });

    it('returns 0 when the update reports no affected rows', async () => {
      jest
        .spyOn(repository, 'update')
        .mockResolvedValue({ affected: null } as any);

      const result = await repository.declinePendingForFeature('feature-1');

      expect(result).toBe(0);
    });
  });

  describe('cancelByChannexBookingId', () => {
    it('cancels non-finished reservations for a Channex booking and returns distinct feature ids', async () => {
      const qb = createQueryBuilderMock();
      qb.execute.mockResolvedValue({
        raw: [
          { featureId: 'feature-1' },
          { featureId: 'feature-2' },
          { featureId: 'feature-2' },
        ],
      });
      mockCreateQueryBuilder(repository, qb);

      const result = await repository.cancelByChannexBookingId('booking-1');

      expect(qb.update).toHaveBeenCalled();
      expect(qb.set).toHaveBeenCalledWith({
        status: ReservationStatus.DECLINED,
      });
      expect(qb.where).toHaveBeenCalledWith(
        '"channexBookingId" = :channexBookingId',
        {
          channexBookingId: 'booking-1',
        },
      );
      expect(qb.andWhere).toHaveBeenCalledWith('status != :finished', {
        finished: ReservationStatus.FINISHED,
      });
      expect(qb.returning).toHaveBeenCalledWith('"featureId"');
      expect(result).toEqual(['feature-1', 'feature-2']);
    });
  });
});
