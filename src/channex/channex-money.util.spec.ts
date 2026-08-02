import { toMinorUnits } from './channex-money.util';

describe('toMinorUnits', () => {
  it('converts a decimal major-unit amount to integer minor units', () => {
    expect(toMinorUnits(49.99)).toBe(4999);
  });

  it('rounds to the nearest minor unit for floating point noise', () => {
    expect(toMinorUnits(10.005)).toBe(1001);
  });

  it('handles whole numbers', () => {
    expect(toMinorUnits(10)).toBe(1000);
  });

  it('handles zero', () => {
    expect(toMinorUnits(0)).toBe(0);
  });
});
