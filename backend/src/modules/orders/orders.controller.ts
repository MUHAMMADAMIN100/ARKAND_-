import { Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Role } from '@prisma/client';
import {
  createOrderSchema,
  orderFilterSchema,
  orderStatusChangeSchema,
  updateOrderSchema,
  type CreateOrderInput,
  type OrderFilter,
  type OrderStatusChangeInput,
  type UpdateOrderInput,
} from '@sheben/shared';
import { CurrentUser, Roles, ZBody, ZodQueryPipe } from '../../common';
import type { RequestUser } from '../../common';
import { OrdersService } from './orders.service';

/** Роли, создающие/меняющие заказы. Читают заказы все аутентифицированные роли. */
const WRITE_ROLES: Role[] = ['OPERATOR', 'SALES_MANAGER', 'OWNER', 'ADMIN'];

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@Query(new ZodQueryPipe(orderFilterSchema)) filter: OrderFilter) {
    return this.orders.list(filter);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.orders.getById(id);
  }

  @Roles(...WRITE_ROLES)
  @Post()
  create(@ZBody(createOrderSchema) dto: CreateOrderInput, @CurrentUser() user: RequestUser) {
    return this.orders.create(dto, user);
  }

  @Roles(...WRITE_ROLES)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @ZBody(updateOrderSchema) dto: UpdateOrderInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.orders.update(id, dto, user);
  }

  @Roles(...WRITE_ROLES)
  @Patch(':id/status')
  changeStatus(
    @Param('id') id: string,
    @ZBody(orderStatusChangeSchema) dto: OrderStatusChangeInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.orders.changeStatus(id, dto, user);
  }

  @Roles(...WRITE_ROLES)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.orders.remove(id, user);
  }
}
