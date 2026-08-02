import {
  isEmail,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { ContactType } from '../../entity/resort-contact.entity';

const PHONE_REGEX = /^\+?[0-9\s\-()]{6,20}$/;

function isValidContactForType(
  value: unknown,
  args: ValidationArguments,
): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  const type = (args.object as { type?: ContactType }).type;
  if (type === ContactType.EMAIL) {
    return isEmail(value);
  }
  if (type === ContactType.PHONE) {
    return PHONE_REGEX.test(value);
  }

  return false;
}

export function IsValidContactForType(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidContactForType',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate: isValidContactForType,
        defaultMessage(args: ValidationArguments) {
          const type = (args.object as { type?: ContactType }).type;
          if (type === ContactType.EMAIL) {
            return 'contact must be a valid email address';
          }
          if (type === ContactType.PHONE) {
            return 'contact must be a valid phone number (digits and + - ( ) spaces only)';
          }
          return 'contact is not valid for the given type';
        },
      },
    });
  };
}
