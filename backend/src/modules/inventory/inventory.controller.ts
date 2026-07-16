import { Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  completeInventorySchema,
  startInventorySchema,
  submitCountsSchema,
  type CompleteInventoryInput,
  type StartInventoryInput,
  type SubmitCountsInput,
} from '@sheben/shared';
import { CurrentUser, Roles, ZBody, ZodQueryPipe } from '../../common';
import type { RequestUser } from '../../common';
import { inventoryFilterSchema, type InventoryFilter } from './inventory.filters';
import { InventoryService } from './inventory.service';

/** Инвентаризация складов (ИНВ-01..09). Запуск/завершение — снабжение; пересчёт — оператор. */
@ApiTags('inventory')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  list(@Query(new ZodQueryPipe(inventoryFilterSchema)) query: InventoryFilter) {
    return this.inventory.list(query);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.inventory.getById(id);
  }

  @Post()
  @Roles('SUPPLY_MANAGER', 'OWNER', 'ADMIN')
  start(@ZBody(startInventorySchema) dto: StartInventoryInput, @CurrentUser() user: RequestUser) {
    return this.inventory.start(dto, user);
  }

  @Post(':id/count')
  @HttpCode(200)
  @Roles('OPERATOR', 'SUPPLY_MANAGER', 'OWNER', 'ADMIN')
  submitCounts(
    @Param('id') id: string,
    @ZBody(submitCountsSchema) dto: SubmitCountsInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.inventory.submitCounts(id, dto, user);
  }

  @Post(':id/complete')
  @HttpCode(200)
  @Roles('SUPPLY_MANAGER', 'OWNER', 'ADMIN')
  complete(
    @Param('id') id: string,
    @ZBody(completeInventorySchema) dto: CompleteInventoryInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.inventory.complete(id, dto, user);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @Roles('SUPPLY_MANAGER', 'OWNER', 'ADMIN')
  cancel(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.inventory.cancel(id, user);
  }
}
