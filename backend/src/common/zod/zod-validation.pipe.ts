import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ZodType } from 'zod';

/**
 * Пайп валидации через Zod-схему (общие схемы из @sheben/shared).
 * Возвращает 400 с массивом ошибок по полям — фронт показывает их в форме.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const fieldErrors = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || '_',
        message: issue.message,
      }));
      throw new BadRequestException({
        message: 'Ошибка валидации',
        errors: fieldErrors,
      });
    }
    return result.data;
  }
}
