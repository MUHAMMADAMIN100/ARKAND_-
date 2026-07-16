import { http } from '../../shared/api/http';
import type { ClientDto, CreateClientInput, UpdateClientInput, ClientType, Paginated } from '@sheben/shared';

export interface ClientsQuery {
  type?: ClientType | '';
  search?: string;
  page?: number;
  pageSize?: number;
}

export const clientKeys = {
  all: ['clients'] as const,
  list: (params?: ClientsQuery) => ['clients', 'list', params ?? {}] as const,
};

export function fetchClients(params?: ClientsQuery): Promise<Paginated<ClientDto>> {
  return http.get<Paginated<ClientDto>>('/clients', {
    query: {
      type: params?.type || undefined,
      search: params?.search || undefined,
      page: params?.page,
      pageSize: params?.pageSize,
    },
  });
}

export function createClient(input: CreateClientInput): Promise<ClientDto> {
  return http.post<ClientDto>('/clients', input);
}

export function updateClient(id: string, input: UpdateClientInput): Promise<ClientDto> {
  return http.patch<ClientDto>(`/clients/${id}`, input);
}

export function deleteClient(id: string): Promise<void> {
  return http.delete<void>(`/clients/${id}`);
}
