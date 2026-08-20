// The resolved price/policy for one date (or one contiguous range of dates
// that all resolve identically) — either from a matching RatePeriod or the
// feature's own base price/quantity when nothing overrides it.
export interface ResolvedRate {
  price: number;
  minStay: number | null;
  stopSell: boolean;
  closedToArrival: boolean;
  closedToDeparture: boolean;
  source: 'season' | 'default';
  periodId: string | null;
}

export interface ResolvedRateRange extends ResolvedRate {
  startDate: string; // 'YYYY-MM-DD'
  endDate: string; // 'YYYY-MM-DD', inclusive
}
