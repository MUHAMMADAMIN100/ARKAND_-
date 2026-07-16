import { http } from '../../shared/api/http';
import type { ProductDto, CreateProductInput, UpdateProductInput } from '@sheben/shared';

export const productKeys = {
  all: ['products'] as const,
  list: (params?: Record<string, unknown>) => ['products', 'list', params ?? {}] as const,
};

export function fetchProducts(params?: { kind?: string; all?: boolean }): Promise<ProductDto[]> {
  return http.get<ProductDto[]>('/products', { query: params as Record<string, string | boolean | undefined> });
}

export function createProduct(input: CreateProductInput): Promise<ProductDto> {
  return http.post<ProductDto>('/products', input);
}

export function updateProduct(id: string, input: UpdateProductInput): Promise<ProductDto> {
  return http.patch<ProductDto>(`/products/${id}`, input);
}

export function deleteProduct(id: string): Promise<void> {
  return http.delete<void>(`/products/${id}`);
}
