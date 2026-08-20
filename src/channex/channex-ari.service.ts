import { Injectable, Logger } from '@nestjs/common';
import { ResortFeatureRepository } from '../repository/resort-feature.repository';
import { ReservationRepository } from '../repository/reservation.repository';
import { RatePeriodRepository } from '../repository/rate-period.repository';
import { ChannexApiClient } from './channex-api.client';
import { toMinorUnits } from './channex-money.util';
import { resolveRateRanges } from '../rate-period/rate-period.util';

const AVAILABILITY_WINDOW_DAYS = 365;
const RESTRICTIONS_WINDOW_DAYS = 730;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function today(): Date {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function diffDays(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

interface AvailabilityRange {
  date_from: string;
  date_to: string;
  availability: number;
}

// Compresses a per-day array into contiguous equal-value ranges — sending one
// value per date for a year is thousands of entries; Channex wants ranges.
function runLengthEncode(
  byDay: number[],
  windowStart: Date,
): AvailabilityRange[] {
  const ranges: AvailabilityRange[] = [];
  let rangeStart = 0;

  for (let i = 1; i <= byDay.length; i++) {
    if (i === byDay.length || byDay[i] !== byDay[rangeStart]) {
      ranges.push({
        date_from: formatDate(addDays(windowStart, rangeStart)),
        date_to: formatDate(addDays(windowStart, i - 1)),
        availability: byDay[rangeStart],
      });
      rangeStart = i;
    }
  }

  return ranges;
}

@Injectable()
export class ChannexAriService {
  private readonly logger = new Logger(ChannexAriService.name);

  constructor(
    private readonly channexApiClient: ChannexApiClient,
    private readonly resortFeatureRepository: ResortFeatureRepository,
    private readonly reservationRepository: ReservationRepository,
    private readonly ratePeriodRepository: RatePeriodRepository,
  ) {}

  async pushAvailability(featureId: string): Promise<void> {
    const feature = await this.resortFeatureRepository.findOne({
      where: { id: featureId },
      relations: { resort: true },
    });
    if (!feature) {
      this.logger.warn(
        `Cannot push availability: feature ${featureId} not found`,
      );
      return;
    }
    if (!feature.resort.channexPropertyId || !feature.channexRoomTypeId) {
      this.logger.debug(
        `Skipping availability push for feature ${featureId}: not mapped to Channex yet`,
      );
      return;
    }

    const windowStart = today();
    const windowEnd = addDays(windowStart, AVAILABILITY_WINDOW_DAYS);

    const reservations = await this.reservationRepository.findActiveOverlapping(
      featureId,
      windowStart,
      windowEnd,
    );

    // Sweep-line over day offsets: +1 at the first occupied night, -1 the day
    // after the last occupied night (checkout day itself is free), then a
    // prefix sum gives occupied-count per day.
    const delta = new Array<number>(AVAILABILITY_WINDOW_DAYS + 1).fill(0);
    for (const reservation of reservations) {
      // TypeORM's `date` columns come back from pg as plain 'YYYY-MM-DD'
      // strings at runtime despite the `Date`-typed entity field, so these
      // need an explicit parse before any Date arithmetic below.
      const reservationStart = new Date(reservation.startDate);
      const reservationEnd = new Date(reservation.endDate);
      const occStart =
        reservationStart < windowStart ? windowStart : reservationStart;
      const occEnd = reservationEnd > windowEnd ? windowEnd : reservationEnd;
      delta[diffDays(windowStart, occStart)] += 1;
      delta[diffDays(windowStart, occEnd)] -= 1;
    }

    const byDay: number[] = [];
    let occupied = 0;
    for (let i = 0; i < AVAILABILITY_WINDOW_DAYS; i++) {
      occupied += delta[i];
      byDay.push(Math.max(feature.quantity - occupied, 0));
    }

    const values = runLengthEncode(byDay, windowStart).map((range) => ({
      property_id: feature.resort.channexPropertyId,
      room_type_id: feature.channexRoomTypeId,
      date_from: range.date_from,
      date_to: range.date_to,
      availability: range.availability,
    }));

    await this.channexApiClient.post('/availability', { values });
    this.logger.log(
      `Pushed availability for feature ${featureId} (${values.length} range(s))`,
    );
  }

  async pushRestrictions(featureId: string): Promise<void> {
    const feature = await this.resortFeatureRepository.findOne({
      where: { id: featureId },
      relations: { resort: true },
    });
    if (!feature) {
      this.logger.warn(
        `Cannot push restrictions: feature ${featureId} not found`,
      );
      return;
    }
    if (!feature.resort.channexPropertyId || !feature.channexRatePlanId) {
      this.logger.debug(
        `Skipping restrictions push for feature ${featureId}: not mapped to Channex yet`,
      );
      return;
    }

    const windowStart = today();
    const windowEnd = addDays(windowStart, RESTRICTIONS_WINDOW_DAYS);

    const periods =
      await this.ratePeriodRepository.findAllForFeature(featureId);
    const resolved = resolveRateRanges(
      periods,
      windowStart,
      windowEnd,
      feature.price,
    );

    // Restrictions are applied as partial updates, so only ever send a field
    // for a decision that was actually made — a `RatePeriod` with no minStay
    // set (or no matching period at all) must never assert min_stay_arrival:
    // 0, which Channex would read as "no minimum," a real (wrong) policy
    // statement, not "we have no opinion." Same reasoning for the booleans:
    // they default to `false` on RatePeriod itself (an explicit "not
    // closed"), which is the correct thing to assert either way.
    const values = resolved.map((range) => ({
      property_id: feature.resort.channexPropertyId,
      rate_plan_id: feature.channexRatePlanId,
      date_from: range.startDate,
      date_to: range.endDate,
      rate: toMinorUnits(range.price),
      ...(range.minStay !== null ? { min_stay_arrival: range.minStay } : {}),
      stop_sell: range.stopSell,
      closed_to_arrival: range.closedToArrival,
      closed_to_departure: range.closedToDeparture,
    }));

    await this.channexApiClient.post('/restrictions', { values });
    this.logger.log(
      `Pushed restrictions for feature ${featureId} (${values.length} range(s))`,
    );
  }
}
