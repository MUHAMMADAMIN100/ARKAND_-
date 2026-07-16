import { zodResolver } from '@hookform/resolvers/zod';
import type { FieldValues, Resolver } from 'react-hook-form';
import type { ZodType } from 'zod';

/**
 * Обёртка zodResolver для React Hook Form.
 * Схемы с .default()/.refine() имеют разные input/output типы, из-за чего обычный
 * zodResolver конфликтует с useForm<T>. Тип T выводится из useForm<T> контекстно;
 * резолвер приводится к Resolver<T> (значения провалидированы Zod-схемой в рантайме).
 */
export function zodForm<T extends FieldValues = FieldValues>(schema: ZodType): Resolver<T> {
  return zodResolver(schema as never) as unknown as Resolver<T>;
}
