import { http } from '../../shared/api/http';
import type {
  CreatePurchaseRequestInput,
  MarkPurchasedInput,
  OwnerDecisionInput,
  Paginated,
  PurchaseRequestDto,
  PurchaseStatus,
  ReceivePurchaseInput,
  UpdatePurchaseRequestInput,
} from '@sheben/shared';

export type PurchaseRequestListParams = {
  status?: PurchaseStatus;
  page: number;
  pageSize: number;
}

export const procurementKeys = {
  all: ['procurement'] as const,
  list: (params: PurchaseRequestListParams) => ['procurement', 'requests', 'list', params] as const,
  detail: (id: string) => ['procurement', 'requests', 'detail', id] as const,
};

export function fetchPurchaseRequests(params: PurchaseRequestListParams): Promise<Paginated<PurchaseRequestDto>> {
  return http.get<Paginated<PurchaseRequestDto>>('/procurement/requests', {
    query: params as Record<string, string | number | undefined>,
  });
}

export function fetchPurchaseRequest(id: string): Promise<PurchaseRequestDto> {
  return http.get<PurchaseRequestDto>(`/procurement/requests/${id}`);
}

export function createPurchaseRequest(input: CreatePurchaseRequestInput): Promise<PurchaseRequestDto> {
  return http.post<PurchaseRequestDto>('/procurement/requests', input);
}

export function updatePurchaseRequest(id: string, input: UpdatePurchaseRequestInput): Promise<PurchaseRequestDto> {
  return http.patch<PurchaseRequestDto>(`/procurement/requests/${id}`, input);
}

export function decidePurchaseRequest(id: string, input: OwnerDecisionInput): Promise<PurchaseRequestDto> {
  return http.post<PurchaseRequestDto>(`/procurement/requests/${id}/decision`, input);
}

export function markPurchaseRequestPurchased(id: string, input: MarkPurchasedInput): Promise<PurchaseRequestDto> {
  return http.post<PurchaseRequestDto>(`/procurement/requests/${id}/purchase`, input);
}

export function receivePurchaseRequest(id: string, input: ReceivePurchaseInput): Promise<PurchaseRequestDto> {
  return http.post<PurchaseRequestDto>(`/procurement/requests/${id}/receive`, input);
}

export function cancelPurchaseRequest(id: string): Promise<PurchaseRequestDto> {
  return http.post<PurchaseRequestDto>(`/procurement/requests/${id}/cancel`);
}
