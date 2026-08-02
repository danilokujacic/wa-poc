import { Test, TestingModule } from '@nestjs/testing';
import { ReservationStatusScheduler } from './reservation-status.scheduler';
import { ReservationRepository } from '../repository/reservation.repository';

describe('ReservationStatusScheduler', () => {
  let scheduler: ReservationStatusScheduler;
  let reservationRepository: { declineStalePending: jest.Mock };

  beforeEach(async () => {
    reservationRepository = { declineStalePending: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationStatusScheduler,
        { provide: ReservationRepository, useValue: reservationRepository },
      ],
    }).compile();

    scheduler = module.get<ReservationStatusScheduler>(
      ReservationStatusScheduler,
    );
  });

  it('should be defined', () => {
    expect(scheduler).toBeDefined();
  });

  it('auto-declines stale pending reservations as of today at UTC midnight', async () => {
    reservationRepository.declineStalePending.mockResolvedValue([
      'feature-1',
      'feature-2',
    ]);

    await scheduler.declineStalePendingReservations();

    expect(reservationRepository.declineStalePending).toHaveBeenCalledTimes(1);
    const [cutoff] = reservationRepository.declineStalePending.mock
      .calls[0] as [Date];
    expect(cutoff.getUTCHours()).toBe(0);
    expect(cutoff.getUTCMinutes()).toBe(0);
    expect(cutoff.getUTCSeconds()).toBe(0);
    expect(cutoff.getUTCMilliseconds()).toBe(0);
  });

  it('does nothing further when no reservations needed transitioning', async () => {
    reservationRepository.declineStalePending.mockResolvedValue([]);

    await expect(
      scheduler.declineStalePendingReservations(),
    ).resolves.toBeUndefined();

    expect(reservationRepository.declineStalePending).toHaveBeenCalledTimes(1);
  });
});
