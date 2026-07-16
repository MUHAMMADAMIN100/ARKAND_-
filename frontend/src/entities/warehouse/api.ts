import { z } from 'zod';
import { http } from '../../shared/api/http';
import {
  qtyOrZeroSchema,
  uuidSchema,
  WarehouseType,
  type CursorPage,
  type MovementFilter,
  type StockItemDto,
  type StockMovementDto,
  type WarehouseDto,
} from '@sheben/shared';

export const warehouseKeys = {
  all: ['warehouse'] as const,
  list: ['warehouse', 'list'] as const,
  stockAll: ['warehouse', 'stock'] as const,
  stock: (params: Record<string, unknown>) => ['warehouse', 'stock', params] as const,
  movementsAll: ['warehouse', 'movements'] as const,
  movements: (params: Record<string, unknown>) => ['warehouse', 'movements', params] as const,
};

export function fetchWarehouses(): Promise<WarehouseDto[]> {
  return http.get<WarehouseDto[]>('/warehouse/list');
}

export type StockFilterParams = {
  warehouseId?: string;
  belowMin?: boolean;
}

export function fetchStock(params: StockFilterParams): Promise<StockItemDto[]> {
  return http.get<StockItemDto[]>('/warehouse/stock', {
    query: params as Record<string, string | boolean | undefined>,
  });
}

export function fetchMovements(params: MovementFilter): Promise<CursorPage<StockMovementDto>> {
  return http.get<CursorPage<StockMovementDto>>('/warehouse/movements', {
    query: params as Record<string, string | number | undefined>,
  });
}

/** Ручная корректировка остатка (ЩЕБ-корректировка). Контракт совпадает с backend adjustStockSchema. */
export const adjustStockSchema = z.object({
  warehouseType: z.enum(WarehouseType),
  productId: uuidSchema,
  targetQty: qtyOrZeroSchema,
  comment: z
    .string()
    .trim()
    .min(3, 'Комментарий должен содержать минимум 3 символа')
    .max(500, 'Слишком длинный комментарий'),
});
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

export function adjustStock(input: AdjustStockInput): Promise<StockItemDto> {
  return http.post<StockItemDto>('/warehouse/adjust', input);
}
