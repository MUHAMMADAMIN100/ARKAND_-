import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  createDebtEntrySchema,
  offsetPaginationSchema,
  type CreateDebtEntryInput,
  type OffsetPagination,
} from '@sheben/shared';
import { CurrentUser, Roles, ZBody, ZodQueryPipe } from '../../common';
import type { RequestUser } from '../../common';
import { DebtRegistryService } from './debt-registry.service';

const DEBT_ROLES = ['FINANCIER', 'OWNER', 'ADMIN'] as const;

@ApiTags('finance')
@Controller('finance/debts')
export class DebtRegistryController {
  constructor(private readonly debtRegistry: DebtRegistryService) {}

  @Roles(...DEBT_ROLES)
  @Get()
  getRegistry() {
    return this.debtRegistry.getRegistry();
  }

  @Roles(...DEBT_ROLES)
  @Get(':clientId')
  getHistory(
    @Param('clientId') clientId: string,
    @Query(new ZodQueryPipe(offsetPaginationSchema)) pagination: OffsetPagination,
  ) {
    return this.debtRegistry.getHistory(clientId, pagination.page, pagination.pageSize);
  }

  @Roles(...DEBT_ROLES)
  @Post()
  createEntry(@CurrentUser() user: RequestUser, @ZBody(createDebtEntrySchema) dto: CreateDebtEntryInput) {
    return this.debtRegistry.createEntry(user, dto);
  }
}
