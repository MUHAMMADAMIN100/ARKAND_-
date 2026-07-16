import { Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  createProductSchema,
  ProductKind,
  updateProductSchema,
  type CreateProductInput,
  type UpdateProductInput,
} from '@sheben/shared';
import { z } from 'zod';
import { CatalogService } from './catalog.service';
import { Roles, ZBody, ZodQueryPipe } from '../../common';

const productsFilterSchema = z.object({
  kind: z.enum(ProductKind).optional(),
  all: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});
type ProductsFilterQuery = z.infer<typeof productsFilterSchema>;

/** Каталог продукции (фракций). Чтение — всем ролям; изменение — OWNER/ADMIN/OPERATOR. */
@ApiTags('products')
@Controller('products')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list(@Query(new ZodQueryPipe(productsFilterSchema)) query: ProductsFilterQuery) {
    return this.catalog.list(query);
  }

  @Post()
  @Roles('OWNER', 'ADMIN', 'OPERATOR')
  create(@ZBody(createProductSchema) dto: CreateProductInput) {
    return this.catalog.create(dto);
  }

  @Patch(':id')
  @Roles('OWNER', 'ADMIN', 'OPERATOR')
  update(@Param('id') id: string, @ZBody(updateProductSchema) dto: UpdateProductInput) {
    return this.catalog.update(id, dto);
  }

  @Delete(':id')
  @Roles('OWNER', 'ADMIN', 'OPERATOR')
  deactivate(@Param('id') id: string) {
    return this.catalog.deactivate(id);
  }
}
