import { Body } from '@nestjs/common';
import { ZodType } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

/** @ZBody(schema) — валидирует тело запроса Zod-схемой. */
export function ZBody(schema: ZodType): ParameterDecorator {
  return Body(new ZodValidationPipe(schema));
}
