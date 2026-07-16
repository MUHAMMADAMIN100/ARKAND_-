import { Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { movementFilterSchema, qtyOrZeroSchema, uuidSchema, WarehouseType, type MovementFilter } from '@sheben/shared';
import { z } from 'zod';
import { WarehouseService } from './warehouse.service';
import { CurrentUser, Roles, ZBody, ZodQueryPipe } from '../../common';
import type { RequestUser } from '../../common';

const stockQuerySchema = z.object({
  warehouseId: uuidSchema.optional(),
  belowMin: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});
type StockQuery = z.infer<typeof stockQuerySchema>;

const adjustStockSchema = z.object({
  warehouseType: z.enum(WarehouseType),
  productId: uuidSchema,
  targetQty: qtyOrZeroSchema,
  comment: z
    .string()
    .trim()
    .min(3, 'Комментарий должен содержать минимум 3 символа')
    .max(500, 'Слишком длинный комментарий'),
});
type AdjustStockInput = z.infer<typeof adjustStockSchema>;

/** Склады, остатки и движения. Чтение — всем ролям; ручная корректировка — OWNER/ADMIN. */
@ApiTags('warehouse')
@Controller('warehouse')
export class WarehouseController {
  constructor(private readonly warehouse: WarehouseService) {}

  @Get('stock')
  getStock(@Query(new ZodQueryPipe(stockQuerySchema)) query: StockQuery) {
    return this.warehouse.getStock(query);
  }

  @Get('movements')
  getMovements(@Query(new ZodQueryPipe(movementFilterSchema)) query: MovementFilter) {
    return this.warehouse.getMovements(query);
  }

  @Get('list')
  listWarehouses() {
    return this.warehouse.listWarehouses();
  }

  @Post('adjust')
  @Roles('OWNER', 'ADMIN')
  adjustStock(@ZBody(adjustStockSchema) dto: AdjustStockInput, @CurrentUser() user: RequestUser) {
    return this.warehouse.adjustStock(user, dto);
  }
}
