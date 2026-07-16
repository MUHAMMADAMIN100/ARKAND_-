import { Injectable, NotFoundException } from '@nestjs/common';
import { ProductKind } from '@prisma/client';
import type { CreateProductInput, ProductDto, UpdateProductInput } from '@sheben/shared';
import { toProductDto } from './catalog.mapper';
import { CatalogRepository, type ProductsListFilter } from './catalog.repository';
import { numToDec, TransactionHost } from '../../common';

@Injectable()
export class CatalogService {
  constructor(
    private readonly repo: CatalogRepository,
    private readonly txHost: TransactionHost,
  ) {}

  async list(filter: ProductsListFilter): Promise<ProductDto[]> {
    const products = await this.repo.findMany(filter);
    const stockByProduct = await this.repo.getStockByProducts(products.map((p) => ({ id: p.id, kind: p.kind })));
    return products.map((p) => toProductDto(p, stockByProduct.get(p.id) ?? 0));
  }

  async create(dto: CreateProductInput): Promise<ProductDto> {
    return this.txHost.run(async () => {
      const created = await this.repo.create({
        name: dto.name,
        kind: dto.kind,
        unit: dto.unit,
        price: numToDec(dto.price),
        minStock: dto.minStock !== undefined ? numToDec(dto.minStock) : null,
        sortOrder: dto.sortOrder,
      });
      // Новая позиция — остатка на складе ещё нет.
      return toProductDto(created, 0);
    });
  }

  async update(id: string, dto: UpdateProductInput): Promise<ProductDto> {
    return this.txHost.run(async () => {
      const existing = await this.repo.findById(id);
      if (!existing) {
        throw new NotFoundException('Продукция не найдена');
      }

      const updated = await this.repo.update(id, {
        name: dto.name,
        kind: dto.kind,
        unit: dto.unit,
        price: dto.price !== undefined ? numToDec(dto.price) : undefined,
        minStock: dto.minStock !== undefined ? numToDec(dto.minStock) : undefined,
        isActive: dto.isActive,
        sortOrder: dto.sortOrder,
      });

      const stock = await this.getStock(updated.id, updated.kind);
      return toProductDto(updated, stock);
    });
  }

  async deactivate(id: string): Promise<ProductDto> {
    return this.txHost.run(async () => {
      const existing = await this.repo.findById(id);
      if (!existing) {
        throw new NotFoundException('Продукция не найдена');
      }

      const updated = await this.repo.update(id, { isActive: false });
      const stock = await this.getStock(updated.id, updated.kind);
      return toProductDto(updated, stock);
    });
  }

  private async getStock(productId: string, kind: ProductKind): Promise<number> {
    const stockByProduct = await this.repo.getStockByProducts([{ id: productId, kind }]);
    return stockByProduct.get(productId) ?? 0;
  }
}
