import { Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  createUserSchema,
  resetPasswordSchema,
  Role,
  updateUserSchema,
  type CreateUserInput,
  type ResetPasswordInput,
  type UpdateUserInput,
} from '@sheben/shared';
import { z } from 'zod';
import { UsersService } from './users.service';
import { CurrentUser, Roles, ZBody, ZodQueryPipe } from '../../common';
import type { RequestUser } from '../../common';

const usersFilterSchema = z.object({
  role: z.enum(Role).optional(),
  search: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
type UsersFilterQuery = z.infer<typeof usersFilterSchema>;

/** Управление пользователями — доступно только владельцу и администратору. */
@ApiTags('users')
@Controller('users')
@Roles('OWNER', 'ADMIN')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Query(new ZodQueryPipe(usersFilterSchema)) query: UsersFilterQuery) {
    return this.users.list(query);
  }

  @Post()
  create(@ZBody(createUserSchema) dto: CreateUserInput, @CurrentUser() actor: RequestUser) {
    return this.users.create(dto, actor);
  }

  @Patch(':id')
  update(@Param('id') id: string, @ZBody(updateUserSchema) dto: UpdateUserInput, @CurrentUser() actor: RequestUser) {
    return this.users.update(id, dto, actor);
  }

  @Post(':id/reset-password')
  resetPassword(
    @Param('id') id: string,
    @ZBody(resetPasswordSchema) dto: ResetPasswordInput,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.users.resetPassword(id, dto, actor);
  }

  @Delete(':id')
  deactivate(@Param('id') id: string, @CurrentUser() actor: RequestUser) {
    return this.users.deactivate(id, actor);
  }
}
