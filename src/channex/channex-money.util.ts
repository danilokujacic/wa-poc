// Channex rates are integers in minor units (cents) on writes, decimal major
// units (e.g. feature.price = 49.99) locally.
export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}
