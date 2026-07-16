import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ZodType } from 'zod';

/** Валидация query-параметров (coerce-схемы приводят строки к числам/датам). */
@Injectable()
export class ZodQueryPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    const result = this.schema.safeParse(value ?? {});
    if (!result.success) {
      throw new BadRequestException({
        message: 'Некорректные параметры запроса',
        errors: result.error.issues.map((i) => ({ field: i.path.join('.') || '_', message: i.message })),
      });
    }
    return result.data;
  }
}
