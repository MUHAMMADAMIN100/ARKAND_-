import type { Product } from '@prisma/client';
import type { ProductDto } from '@sheben/shared';
import { decToNum } from '../../common';

/** Product (Prisma) + текущий остаток -> ProductDto. */
export function toProductDto(product: Product, stock: number): ProductDto {
  return {
    id: product.id,
    name: product.name,
    kind: product.kind,
    unit: product.unit,
    price: decToNum(product.price),
    minStock: product.minStock !== null ? decToNum(product.minStock) : null,
    isActive: product.isActive,
    sortOrder: product.sortOrder,
    stock,
  };
}
