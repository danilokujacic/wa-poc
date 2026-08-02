import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ConfirmEmailDto } from './confirm-email.dto';

describe('ConfirmEmailDto', () => {
  it('passes validation for well-formed slug and code strings', async () => {
    const dto = plainToInstance(ConfirmEmailDto, {
      slug: 'a1b2c3d4',
      code: '9f8e7d6c',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('fails validation when slug and code are missing', async () => {
    const dto = plainToInstance(ConfirmEmailDto, {});

    const errors = await validate(dto);

    const properties = errors.map((error) => error.property).sort();
    expect(properties).toEqual(['code', 'slug']);
  });
});
