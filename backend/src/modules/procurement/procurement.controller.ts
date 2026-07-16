import { Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  createPurchaseRequestSchema,
  markPurchasedSchema,
  ownerDecisionSchema,
  receivePurchaseSchema,
  updatePurchaseRequestSchema,
  type CreatePurchaseRequestInput,
  type MarkPurchasedInput,
  type OwnerDecisionInput,
  type ReceivePurchaseInput,
  type UpdatePurchaseRequestInput,
} from '@sheben/shared';
import { CurrentUser, Roles, ZBody, ZodQueryPipe } from '../../common';
import type { RequestUser } from '../../common';
import { ProcurementService } from './procurement.service';
import { purchaseRequestFilterSchema, type PurchaseRequestFilter } from './procurement.schemas';

const VIEW_ROLES = ['SUPPLY_MANAGER', 'OPERATOR', 'OWNER', 'ADMIN'] as const;
const CREATE_ROLES = ['SUPPLY_MANAGER', 'OPERATOR'] as const;
const UPDATE_ROLES = ['SUPPLY_MANAGER', 'OPERATOR', 'OWNER', 'ADMIN'] as const;
const DECISION_ROLES = ['OWNER'] as const;
const PURCHASE_ROLES = ['SUPPLY_MANAGER', 'OWNER', 'ADMIN'] as const;
const RECEIVE_ROLES = ['SUPPLY_MANAGER'] as const;
const CANCEL_ROLES = ['SUPPLY_MANAGER', 'OWNER', 'ADMIN'] as const;

@ApiTags('procurement')
@Controller('procurement/requests')
export class ProcurementController {
  constructor(private readonly procurement: ProcurementService) {}

  @Roles(...VIEW_ROLES)
  @Get()
  list(@Query(new ZodQueryPipe(purchaseRequestFilterSchema)) filter: PurchaseRequestFilter) {
    return this.procurement.list(filter);
  }

  @Roles(...VIEW_ROLES)
  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.procurement.getOne(id);
  }

  @Roles(...CREATE_ROLES)
  @Post()
  create(@CurrentUser() user: RequestUser, @ZBody(createPurchaseRequestSchema) dto: CreatePurchaseRequestInput) {
    return this.procurement.create(user, dto);
  }

  @Roles(...UPDATE_ROLES)
  @Patch(':id')
  update(@Param('id') id: string, @ZBody(updatePurchaseRequestSchema) dto: UpdatePurchaseRequestInput) {
    return this.procurement.update(id, dto);
  }

  @Roles(...DECISION_ROLES)
  @Post(':id/decision')
  decide(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @ZBody(ownerDecisionSchema) dto: OwnerDecisionInput,
  ) {
    return this.procurement.decide(user, id, dto);
  }

  @Roles(...PURCHASE_ROLES)
  @Post(':id/purchase')
  markPurchased(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @ZBody(markPurchasedSchema) dto: MarkPurchasedInput,
  ) {
    return this.procurement.markPurchased(user, id, dto);
  }

  @Roles(...RECEIVE_ROLES)
  @Post(':id/receive')
  receive(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @ZBody(receivePurchaseSchema) dto: ReceivePurchaseInput,
  ) {
    return this.procurement.receive(user, id, dto);
  }

  @Roles(...CANCEL_ROLES)
  @Post(':id/cancel')
  cancel(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.procurement.cancel(user, id);
  }
}
