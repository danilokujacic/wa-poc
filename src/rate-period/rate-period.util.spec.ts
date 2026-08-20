import { RatePeriod } from '../entity/rate-period.entity';
import { resolveRate, resolveRateRanges } from './rate-period.util';

function makePeriod(overrides: Partial<RatePeriod> = {}): RatePeriod {
  return {
    id: 'period-1',
    name: 'Test season',
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    price: 200,
    minStay: null,
    stopSell: false,
    closedToArrival: false,
    closedToDeparture: false,
    priority: 0,
    ...overrides,
  } as RatePeriod;
}

describe('resolveRate', () => {
  it('falls back to the base price when no period covers the date', () => {
    const resolved = resolveRate([], new Date('2026-07-01T00:00:00Z'), 100);
    expect(resolved).toEqual({
      price: 100,
      minStay: null,
      stopSell: false,
      closedToArrival: false,
      closedToDeparture: false,
      source: 'default',
      periodId: null,
    });
  });

  it('uses a matching period over the base price', () => {
    const period = makePeriod({ price: 200, minStay: 3 });
    const resolved = resolveRate(
      [period],
      new Date('2026-06-15T00:00:00Z'),
      100,
    );
    expect(resolved.price).toBe(200);
    expect(resolved.minStay).toBe(3);
    expect(resolved.source).toBe('season');
    expect(resolved.periodId).toBe('period-1');
  });

  it('falls back to the base price for a date just outside the period boundary', () => {
    const period = makePeriod();
    const resolved = resolveRate(
      [period],
      new Date('2026-07-01T00:00:00Z'),
      100,
    );
    expect(resolved.source).toBe('default');
  });

  it('includes both boundary dates as covered by the period', () => {
    const period = makePeriod();
    const start = resolveRate([period], new Date('2026-06-01T00:00:00Z'), 100);
    const end = resolveRate([period], new Date('2026-06-30T00:00:00Z'), 100);
    expect(start.source).toBe('season');
    expect(end.source).toBe('season');
  });

  it('picks the higher-priority period when two overlap the same date', () => {
    const low = makePeriod({ id: 'low', price: 150, priority: 0 });
    const high = makePeriod({ id: 'high', price: 300, priority: 5 });
    const resolved = resolveRate(
      [low, high],
      new Date('2026-06-15T00:00:00Z'),
      100,
    );
    expect(resolved.periodId).toBe('high');
    expect(resolved.price).toBe(300);
  });

  it('breaks a priority tie in favor of the narrower (more specific) date range', () => {
    const season = makePeriod({
      id: 'season',
      startDate: '2026-06-01',
      endDate: '2026-06-30',
      price: 200,
      priority: 0,
    });
    const singleDay = makePeriod({
      id: 'single-day',
      startDate: '2026-06-15',
      endDate: '2026-06-15',
      price: 350,
      priority: 0,
    });
    const resolved = resolveRate(
      [season, singleDay],
      new Date('2026-06-15T00:00:00Z'),
      100,
    );
    expect(resolved.periodId).toBe('single-day');
    expect(resolved.price).toBe(350);
  });

  it('surfaces stopSell/closedToArrival/closedToDeparture from the winning period', () => {
    const period = makePeriod({
      stopSell: true,
      closedToArrival: true,
      closedToDeparture: true,
    });
    const resolved = resolveRate(
      [period],
      new Date('2026-06-15T00:00:00Z'),
      100,
    );
    expect(resolved.stopSell).toBe(true);
    expect(resolved.closedToArrival).toBe(true);
    expect(resolved.closedToDeparture).toBe(true);
  });
});

describe('resolveRateRanges', () => {
  it('collapses a window with no periods into a single default range', () => {
    const ranges = resolveRateRanges(
      [],
      new Date('2026-06-01T00:00:00Z'),
      new Date('2026-06-10T00:00:00Z'),
      100,
    );
    expect(ranges).toHaveLength(1);
    expect(ranges[0]).toMatchObject({
      startDate: '2026-06-01',
      endDate: '2026-06-09', // window end is exclusive, same convention as ChannexAriService
      price: 100,
      source: 'default',
    });
  });

  it('splits the window at a period boundary into separate ranges', () => {
    const period = makePeriod({
      startDate: '2026-06-05',
      endDate: '2026-06-07',
      price: 250,
    });
    const ranges = resolveRateRanges(
      [period],
      new Date('2026-06-01T00:00:00Z'),
      new Date('2026-06-10T00:00:00Z'),
      100,
    );

    expect(ranges).toEqual([
      expect.objectContaining({
        startDate: '2026-06-01',
        endDate: '2026-06-04',
        price: 100,
        source: 'default',
      }),
      expect.objectContaining({
        startDate: '2026-06-05',
        endDate: '2026-06-07',
        price: 250,
        source: 'season',
      }),
      expect.objectContaining({
        startDate: '2026-06-08',
        endDate: '2026-06-09',
        price: 100,
        source: 'default',
      }),
    ]);
  });

  it('merges two adjacent periods with identical resolved values into one range', () => {
    // Same price/policy on both sides of the join — the encoder should not
    // split them into two ranges just because they came from different rows.
    const first = makePeriod({
      id: 'a',
      startDate: '2026-06-01',
      endDate: '2026-06-04',
      price: 250,
    });
    const second = makePeriod({
      id: 'b',
      startDate: '2026-06-05',
      endDate: '2026-06-09',
      price: 250,
    });
    const ranges = resolveRateRanges(
      [first, second],
      new Date('2026-06-01T00:00:00Z'),
      new Date('2026-06-10T00:00:00Z'),
      100,
    );
    expect(ranges).toHaveLength(1);
    expect(ranges[0]).toMatchObject({
      startDate: '2026-06-01',
      endDate: '2026-06-09',
      price: 250,
    });
  });
});
