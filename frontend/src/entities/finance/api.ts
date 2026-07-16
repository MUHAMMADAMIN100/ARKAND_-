import { http } from '../../shared/api/http';
import type {
  CashCategory,
  CashDecisionInput,
  CashDirection,
  CashStatus,
  CashTransactionDto,
  ClientDto,
  ClientType,
  CreateCashTransactionInput,
  CreateDebtEntryInput,
  DebtBalanceDto,
  DebtEntryDto,
  Paginated,
} from '@sheben/shared';

export type CashListParams = {
  direction?: CashDirection;
  status?: CashStatus;
  category?: CashCategory;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}

/** GET /finance/debts — реестр долгов холдинга. */
export interface DebtRegistryResult {
  items: DebtBalanceDto[];
  totalBalance: number;
}

/** GET /finance/debts/:clientId — история операций по клиенту + текущий баланс. */
export interface DebtHistoryResult extends Paginated<DebtEntryDto> {
  balance: number;
}

export type ClientListParams = {
  type?: ClientType;
  search?: string;
  page?: number;
  pageSize?: number;
}

export const financeKeys = {
  all: ['finance'] as const,
  cashList: (params: CashListParams) => ['finance', 'cash', 'list', params] as const,
  debtRegistry: ['finance', 'debts', 'registry'] as const,
  debtHistory: (clientId: string, page: number, pageSize: number) =>
    ['finance', 'debts', 'history', clientId, page, pageSize] as const,
  clients: (params: ClientListParams) => ['finance', 'clients', params] as const,
};

export function fetchCashTransactions(params: CashListParams): Promise<Paginated<CashTransactionDto>> {
  return http.get<Paginated<CashTransactionDto>>('/finance/cash', {
    query: params as Record<string, string | number | undefined>,
  });
}

export function createCashTransaction(input: CreateCashTransactionInput): Promise<CashTransactionDto> {
  return http.post<CashTransactionDto>('/finance/cash', input);
}

export function decideCashTransaction(id: string, input: CashDecisionInput): Promise<CashTransactionDto> {
  return http.patch<CashTransactionDto>(`/finance/cash/${id}/decision`, input);
}

export function fetchDebtRegistry(): Promise<DebtRegistryResult> {
  return http.get<DebtRegistryResult>('/finance/debts');
}

export function fetchDebtHistory(clientId: string, page: number, pageSize: number): Promise<DebtHistoryResult> {
  return http.get<DebtHistoryResult>(`/finance/debts/${clientId}`, { query: { page, pageSize } });
}

export function createDebtEntry(input: CreateDebtEntryInput): Promise<DebtEntryDto> {
  return http.post<DebtEntryDto>('/finance/debts', input);
}

/** Справочник клиентов (используется для выбора клиента в кассе и в долгах — только INTERNAL). */
export function fetchClients(params: ClientListParams = {}): Promise<Paginated<ClientDto>> {
  return http.get<Paginated<ClientDto>>('/clients', {
    query: params as Record<string, string | number | undefined>,
  });
}
