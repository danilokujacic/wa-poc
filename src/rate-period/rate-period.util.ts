import { RatePeriod } from '../entity/rate-period.entity';
import type { ResolvedRate, ResolvedRateRange } from './rate-period.types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toUtcDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function defaultResolved(basePrice: number): ResolvedRate {
  return {
    price: basePrice,
    minStay: null,
    stopSell: false,
    closedToArrival: false,
    closedToDeparture: false,
    source: 'default',
    periodId: null,
  };
}

// Higher priority wins on overlap; ties broken by the narrowest date range —
// a single-day override should win over a whole-season period even if
// nobody bothered to set a higher priority on it.
function pickWinner(matches: RatePeriod[]): RatePeriod {
  return matches.reduce((best, candidate) => {
    if (candidate.priority !== best.priority) {
      return candidate.priority > best.priority ? candidate : best;
    }
    const bestSpan =
      toUtcDate(best.endDate).getTime() - toUtcDate(best.startDate).getTime();
    const candidateSpan =
      toUtcDate(candidate.endDate).getTime() -
      toUtcDate(candidate.startDate).getTime();
    return candidateSpan < bestSpan ? candidate : best;
  });
}

export function resolveRate(
  periods: RatePeriod[],
  date: Date,
  basePrice: number,
): ResolvedRate {
  const matches = periods.filter(
    (p) => toUtcDate(p.startDate) <= date && date <= toUtcDate(p.endDate),
  );
  if (matches.length === 0) {
    return defaultResolved(basePrice);
  }

  const winner = pickWinner(matches);
  return {
    price: winner.price,
    minStay: winner.minStay,
    stopSell: winner.stopSell,
    closedToArrival: winner.closedToArrival,
    closedToDeparture: winner.closedToDeparture,
    source: 'season',
    periodId: winner.id,
  };
}

function sameResolution(a: ResolvedRate, b: ResolvedRate): boolean {
  return (
    a.price === b.price &&
    a.minStay === b.minStay &&
    a.stopSell === b.stopSell &&
    a.closedToArrival === b.closedToArrival &&
    a.closedToDeparture === b.closedToDeparture
  );
}

// Same run-length-encoding idea ChannexAriService already uses for
// availability: a day-by-day resolve is cheap in memory (periods per
// feature are few), but Channex — and anything else consuming this — wants
// contiguous ranges, not one entry per date.
export function resolveRateRanges(
  periods: RatePeriod[],
  windowStart: Date,
  windowEnd: Date,
  basePrice: number,
): ResolvedRateRange[] {
  const totalDays = Math.round(
    (windowEnd.getTime() - windowStart.getTime()) / MS_PER_DAY,
  );
  const byDay: ResolvedRate[] = [];
  for (let i = 0; i < totalDays; i++) {
    byDay.push(resolveRate(periods, addDays(windowStart, i), basePrice));
  }

  const ranges: ResolvedRateRange[] = [];
  let rangeStart = 0;
  for (let i = 1; i <= byDay.length; i++) {
    if (i === byDay.length || !sameResolution(byDay[i], byDay[rangeStart])) {
      ranges.push({
        ...byDay[rangeStart],
        startDate: formatDate(addDays(windowStart, rangeStart)),
        endDate: formatDate(addDays(windowStart, i - 1)),
      });
      rangeStart = i;
    }
  }
  return ranges;
}
