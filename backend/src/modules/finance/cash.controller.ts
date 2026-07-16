import { Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  cashDecisionSchema,
  cashFilterSchema,
  createCashTransactionSchema,
  type CashDecisionInput,
  type CashFilter,
  type CreateCashTransactionInput,
} from '@sheben/shared';
import { CurrentUser, Roles, ZBody, ZodQueryPipe } from '../../common';
import type { RequestUser } from '../../common';
import { CashService } from './cash.service';

const CASH_VIEW_ROLES = ['OPERATOR', 'SALES_MANAGER', 'FINANCIER', 'OWNER', 'ADMIN'] as const;
const CASH_CREATE_ROLES = ['OPERATOR', 'SALES_MANAGER'] as const;
const CASH_DECISION_ROLES = ['FINANCIER', 'OWNER', 'ADMIN'] as const;

@ApiTags('finance')
@Controller('finance/cash')
export class CashController {
  constructor(private readonly cashService: CashService) {}

  @Roles(...CASH_VIEW_ROLES)
  @Get()
  list(@CurrentUser() user: RequestUser, @Query(new ZodQueryPipe(cashFilterSchema)) filter: CashFilter) {
    return this.cashService.list(user, filter);
  }

  @Roles(...CASH_CREATE_ROLES)
  @Post()
  create(@CurrentUser() user: RequestUser, @ZBody(createCashTransactionSchema) dto: CreateCashTransactionInput) {
    return this.cashService.create(user, dto);
  }

  @Roles(...CASH_DECISION_ROLES)
  @Patch(':id/decision')
  decide(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @ZBody(cashDecisionSchema) dto: CashDecisionInput,
  ) {
    return this.cashService.decide(user, id, dto);
  }
}
