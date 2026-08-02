import { validateSync } from 'class-validator';
import { IsValidContactForType } from './is-valid-contact-for-type.validator';
import { ContactType } from '../../entity/resort-contact.entity';

class ContactDto {
  type: ContactType;

  @IsValidContactForType()
  contact: string;
}

function build(type: ContactType, contact: unknown): ContactDto {
  const dto = new ContactDto();
  dto.type = type;
  dto.contact = contact as string;
  return dto;
}

describe('IsValidContactForType', () => {
  it('accepts a valid email address when type is EMAIL', () => {
    const errors = validateSync(build(ContactType.EMAIL, 'guest@example.com'));
    expect(errors).toHaveLength(0);
  });

  it('rejects an invalid email address when type is EMAIL', () => {
    const errors = validateSync(build(ContactType.EMAIL, 'not-an-email'));
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toEqual({
      isValidContactForType: 'contact must be a valid email address',
    });
  });

  it('accepts a valid phone number when type is PHONE', () => {
    const errors = validateSync(build(ContactType.PHONE, '+1 (555) 123-4567'));
    expect(errors).toHaveLength(0);
  });

  it('rejects an invalid phone number when type is PHONE', () => {
    const errors = validateSync(build(ContactType.PHONE, 'abc'));
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toEqual({
      isValidContactForType:
        'contact must be a valid phone number (digits and + - ( ) spaces only)',
    });
  });

  it('rejects when the value is not a string', () => {
    const errors = validateSync(build(ContactType.PHONE, 12345));
    expect(errors).toHaveLength(1);
  });

  it('rejects and falls back to the generic message for an unrecognized type', () => {
    const errors = validateSync(build('Other' as ContactType, 'anything'));
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toEqual({
      isValidContactForType: 'contact is not valid for the given type',
    });
  });
});
