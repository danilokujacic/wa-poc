import { ArgumentMetadata, PipeTransform, Type } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

/**
 * Like Nest's ValidationPipe, but never rejects the request: any field that
 * fails validation is dropped from the resulting object instead, so the
 * caller sees it exactly as if that field had never been passed at all
 * (letting the DTO's/consumer's own defaults take over).
 */
export class LenientValidationPipe<T extends object> implements PipeTransform {
    constructor(private readonly dtoClass: Type<T>) { }

    transform(value: unknown, _metadata: ArgumentMetadata): T {
        const instance = plainToInstance(this.dtoClass, value ?? {});
        const errors = validateSync(instance as object);

        for (const error of errors) {
            delete (instance as Record<string, unknown>)[error.property];
        }

        return instance;
    }
}
