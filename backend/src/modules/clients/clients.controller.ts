import { Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  ClientType,
  createClientSchema,
  updateClientSchema,
  type CreateClientInput,
  type UpdateClientInput,
} from '@sheben/shared';
import { z } from 'zod';
import { ClientsService } from './clients.service';
import { Roles, ZBody, ZodQueryPipe } from '../../common';

const clientsFilterSchema = z.object({
  type: z.enum(ClientType).optional(),
  search: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
type ClientsFilterQuery = z.infer<typeof clientsFilterSchema>;

/** Клиенты (внешние — наличные, внутренние — бартер/долг холдинга). Чтение — всем ролям. */
@ApiTags('clients')
@Controller('clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  list(@Query(new ZodQueryPipe(clientsFilterSchema)) query: ClientsFilterQuery) {
    return this.clients.list(query);
  }

  @Post()
  @Roles('OWNER', 'ADMIN', 'OPERATOR', 'SALES_MANAGER')
  create(@ZBody(createClientSchema) dto: CreateClientInput) {
    return this.clients.create(dto);
  }

  @Patch(':id')
  @Roles('OWNER', 'ADMIN', 'OPERATOR', 'SALES_MANAGER')
  update(@Param('id') id: string, @ZBody(updateClientSchema) dto: UpdateClientInput) {
    return this.clients.update(id, dto);
  }

  @Delete(':id')
  @Roles('OWNER', 'ADMIN', 'OPERATOR', 'SALES_MANAGER')
  deactivate(@Param('id') id: string) {
    return this.clients.deactivate(id);
  }
}
