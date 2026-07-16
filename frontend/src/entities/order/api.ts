import { http } from '../../shared/api/http';
import type {
  ClientDto,
  CreateOrderInput,
  OrderDto,
  OrderFilter,
  OrderStatus,
  Paginated,
  UpdateOrderInput,
} from '@sheben/shared';

export const orderKeys = {
  all: ['orders'] as const,
  list: (filter: Partial<OrderFilter>) => ['orders', 'list', filter] as const,
  detail: (id: string) => ['orders', 'detail', id] as const,
};

export function fetchOrders(filter: Partial<OrderFilter>): Promise<Paginated<OrderDto>> {
  return http.get<Paginated<OrderDto>>('/orders', {
    query: filter as Record<string, string | number | boolean | undefined>,
  });
}

export function fetchOrder(id: string): Promise<OrderDto> {
  return http.get<OrderDto>(`/orders/${id}`);
}

export function createOrder(input: CreateOrderInput): Promise<OrderDto> {
  return http.post<OrderDto>('/orders', input);
}

export function updateOrder(id: string, input: UpdateOrderInput): Promise<OrderDto> {
  return http.patch<OrderDto>(`/orders/${id}`, input);
}

export function changeOrderStatus(id: string, status: OrderStatus): Promise<OrderDto> {
  return http.patch<OrderDto>(`/orders/${id}/status`, { status });
}

export function deleteOrder(id: string): Promise<void> {
  return http.delete<void>(`/orders/${id}`);
}

/** Справочник клиентов — нужен только форме заказа, локальный хелпер без отдельного entity. */
export const clientKeys = {
  list: (params?: Record<string, unknown>) => ['clients', 'list', params ?? {}] as const,
};

export function fetchClients(params?: { type?: string; page?: number; pageSize?: number }): Promise<Paginated<ClientDto>> {
  return http.get<Paginated<ClientDto>>('/clients', {
    query: params as Record<string, string | number | undefined>,
  });
}
