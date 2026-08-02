import { IsEmail, IsString } from 'class-validator';
import { LenientValidationPipe } from './lenient-validation.pipe';

class SampleDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;
}

describe('LenientValidationPipe', () => {
  let pipe: LenientValidationPipe<SampleDto>;

  beforeEach(() => {
    pipe = new LenientValidationPipe(SampleDto);
  });

  it('returns an instance of the dto class unchanged when every field is valid', () => {
    const result = pipe.transform(
      { name: 'Alice', email: 'alice@example.com' },
      {} as any,
    );

    expect(result).toBeInstanceOf(SampleDto);
    expect(result.name).toBe('Alice');
    expect(result.email).toBe('alice@example.com');
  });

  it('drops fields that fail validation instead of throwing', () => {
    const result = pipe.transform(
      { name: 'Alice', email: 'not-an-email' },
      {} as any,
    );

    expect(result.name).toBe('Alice');
    expect(result.email).toBeUndefined();
  });

  it('treats a null/undefined input as an empty object', () => {
    const result = pipe.transform(undefined, {} as any);

    expect(result).toBeInstanceOf(SampleDto);
    expect(result.name).toBeUndefined();
    expect(result.email).toBeUndefined();
  });
});
