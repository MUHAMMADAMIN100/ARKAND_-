import { Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Role } from '@prisma/client';
import {
  createTalonSchema,
  talonFilterSchema,
  type CreateTalonInput,
  type TalonFilter,
} from '@sheben/shared';
import { CurrentUser, Roles, ZBody, ZodQueryPipe } from '../../common';
import type { RequestUser } from '../../common';
import { ShipmentsService } from './shipments.service';

/** Роли, выдающие/отменяющие/отгружающие талоны. */
const ISSUE_ROLES: Role[] = ['OPERATOR', 'SALES_MANAGER', 'OWNER', 'ADMIN'];
/** Доставку подтверждает водитель (свой талон) или оператор/владелец/админ. */
const DELIVER_ROLES: Role[] = ['DUMP_TRUCK_DRIVER', 'EXCAVATOR_DRIVER', 'OPERATOR', 'OWNER', 'ADMIN'];

@ApiTags('talons')
@Controller('talons')
export class ShipmentsController {
  constructor(private readonly shipments: ShipmentsService) {}

  @Get()
  list(@Query(new ZodQueryPipe(talonFilterSchema)) filter: TalonFilter, @CurrentUser() user: RequestUser) {
    return this.shipments.list(filter, user);
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.shipments.getById(id, user);
  }

  @Roles(...ISSUE_ROLES)
  @Post()
  create(@ZBody(createTalonSchema) dto: CreateTalonInput, @CurrentUser() user: RequestUser) {
    return this.shipments.create(dto, user);
  }

  @Roles(...ISSUE_ROLES)
  @Patch(':id/ship')
  ship(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.shipments.ship(id, user);
  }

  @Roles(...DELIVER_ROLES)
  @Patch(':id/deliver')
  deliver(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.shipments.deliver(id, user);
  }

  @Roles(...ISSUE_ROLES)
  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.shipments.cancel(id, user);
  }
}
