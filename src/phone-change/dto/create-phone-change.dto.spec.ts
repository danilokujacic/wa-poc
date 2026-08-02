import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreatePhoneChangeDto } from './create-phone-change.dto';

describe('CreatePhoneChangeDto', () => {
  it('passes validation for a well-formed phone number', async () => {
    const dto = plainToInstance(CreatePhoneChangeDto, {
      newPhoneNumber: '+382 69 999 999',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('fails validation for a phone number containing invalid characters', async () => {
    const dto = plainToInstance(CreatePhoneChangeDto, {
      newPhoneNumber: 'not-a-phone!',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('matches');
  });
});
