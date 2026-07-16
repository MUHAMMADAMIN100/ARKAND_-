import { http } from '../../shared/api/http';
import type {
  CompleteInventoryInput,
  InventoryDto,
  InventoryStatus,
  Paginated,
  StartInventoryInput,
  StockItemDto,
  SubmitCountsInput,
  UserDto,
  WarehouseDto,
} from '@sheben/shared';

export const inventoryKeys = {
  all: ['inventory'] as const,
  list: (params?: Record<string, unknown>) => ['inventory', 'list', params ?? {}] as const,
  detail: (id: string) => ['inventory', 'detail', id] as const,
};

export type InventoryListParams = {
  status?: InventoryStatus | '';
  page: number;
  pageSize: number;
}

export function fetchInventories(params: InventoryListParams): Promise<Paginated<InventoryDto>> {
  return http.get<Paginated<InventoryDto>>('/inventory', {
    query: { status: params.status || undefined, page: params.page, pageSize: params.pageSize },
  });
}

export function fetchInventory(id: string): Promise<InventoryDto> {
  return http.get<InventoryDto>(`/inventory/${id}`);
}

export function startInventory(input: StartInventoryInput): Promise<InventoryDto> {
  return http.post<InventoryDto>('/inventory', input);
}

export function submitCounts(id: string, input: SubmitCountsInput): Promise<InventoryDto> {
  return http.post<InventoryDto>(`/inventory/${id}/count`, input);
}

export function completeInventory(id: string, input: CompleteInventoryInput): Promise<InventoryDto> {
  return http.post<InventoryDto>(`/inventory/${id}/complete`, input);
}

export function cancelInventory(id: string): Promise<InventoryDto> {
  return http.post<InventoryDto>(`/inventory/${id}/cancel`);
}

/** Справочники для запуска инвентаризации (ЩЕБ-01/02). */
export function fetchWarehousesForInventory(): Promise<WarehouseDto[]> {
  return http.get<WarehouseDto[]>('/warehouse/list');
}

export function fetchWarehouseStockForInventory(warehouseId: string): Promise<StockItemDto[]> {
  return http.get<StockItemDto[]>('/warehouse/stock', { query: { warehouseId } });
}

/** Ответственные для объяснения недостачи при завершении (ИНВ-06). */
export function fetchResponsibleUsers(): Promise<{ items: UserDto[] }> {
  return http.get<{ items: UserDto[] }>('/users');
}
