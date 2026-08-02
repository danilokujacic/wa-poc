import { PhoneChangeResponseDto } from './phone-change-response.dto';
import { PhoneChange } from '../../entity/phone-change.entity';
import { Resort } from '../../entity/resort.entity';

describe('PhoneChangeResponseDto', () => {
  it('maps a PhoneChange entity to the response shape', () => {
    const entity: PhoneChange = {
      id: 'pc-1',
      resort: { id: 'resort-1' } as Resort,
      oldPhoneNumber: '+382 1',
      newPhoneNumber: '+382 69 111 111',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    const dto = PhoneChangeResponseDto.fromEntity(entity);

    expect(dto).toBeInstanceOf(PhoneChangeResponseDto);
    expect(dto).toEqual({
      id: 'pc-1',
      oldPhoneNumber: '+382 1',
      newPhoneNumber: '+382 69 111 111',
      createdAt: entity.createdAt,
    });
  });
});
