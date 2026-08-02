import { validateSync } from 'class-validator';
import { IsTodayOrLater } from './is-today-or-later.validator';

class DateDto {
  @IsTodayOrLater()
  date: unknown;
}

function build(date: unknown): DateDto {
  const dto = new DateDto();
  dto.date = date;
  return dto;
}

describe('IsTodayOrLater', () => {
  it('accepts a date equal to today (UTC midnight)', () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const errors = validateSync(build(today.toISOString()));
    expect(errors).toHaveLength(0);
  });

  it('accepts a date in the future', () => {
    const future = new Date();
    future.setUTCFullYear(future.getUTCFullYear() + 1);
    const errors = validateSync(build(future.toISOString()));
    expect(errors).toHaveLength(0);
  });

  it('rejects a date in the past', () => {
    const errors = validateSync(build('2020-01-01'));
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toEqual({
      isTodayOrLater: 'date must be today or later',
    });
  });

  it('rejects a value that is not a string', () => {
    const errors = validateSync(build(12345));
    expect(errors).toHaveLength(1);
  });

  it('rejects a string that does not parse to a valid date', () => {
    const errors = validateSync(build('not-a-date'));
    expect(errors).toHaveLength(1);
  });
});
