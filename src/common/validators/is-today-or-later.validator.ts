import { registerDecorator, ValidationOptions } from 'class-validator';

function isTodayOrLater(value: unknown): boolean {
    if (typeof value !== 'string') {
        return false;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return false;
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    return date.getTime() >= today.getTime();
}

export function IsTodayOrLater(validationOptions?: ValidationOptions) {
    return function (object: object, propertyName: string) {
        registerDecorator({
            name: 'isTodayOrLater',
            target: object.constructor,
            propertyName,
            options: validationOptions,
            validator: {
                validate: isTodayOrLater,
                defaultMessage() {
                    return `${propertyName} must be today or later`;
                },
            },
        });
    };
}
