import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateUserInput, Paginated, ResetPasswordInput, UpdateUserInput, UserDto } from '@sheben/shared';
import * as bcrypt from 'bcryptjs';
import { toUserDto } from './users.mapper';
import { UsersRepository, type UsersListFilter } from './users.repository';
import { AuditService, buildPaginated, TransactionHost } from '../../common';
import type { RequestUser } from '../../common';

/** Число раундов bcrypt для хэширования паролей. */
const BCRYPT_SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(
    private readonly repo: UsersRepository,
    private readonly txHost: TransactionHost,
    private readonly audit: AuditService,
  ) {}

  async list(filter: UsersListFilter): Promise<Paginated<UserDto>> {
    const { items, total } = await this.repo.findMany(filter);
    return buildPaginated(items.map(toUserDto), total, filter.page, filter.pageSize);
  }

  async create(dto: CreateUserInput, actor: RequestUser): Promise<UserDto> {
    // Роль OWNER — высшая привилегия (одобрение закупок и т.д.). Назначает только владелец.
    if (dto.role === 'OWNER' && actor.role !== 'OWNER') {
      throw new ForbiddenException('Роль «Владелец» может назначать только владелец');
    }
    return this.txHost.run(async () => {
      const existing = await this.repo.findByLogin(dto.login);
      if (existing) {
        throw new ConflictException('Пользователь с таким логином уже существует');
      }

      const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
      const created = await this.repo.create({
        login: dto.login,
        passwordHash,
        fullName: dto.fullName,
        role: dto.role,
        phone: dto.phone ?? null,
      });

      await this.audit.log({ userId: actor.id, action: 'CREATE', entity: 'User', entityId: created.id });
      return toUserDto(created);
    });
  }

  async update(id: string, dto: UpdateUserInput, actor: RequestUser): Promise<UserDto> {
    return this.txHost.run(async () => {
      const existing = await this.repo.findById(id);
      if (!existing) {
        throw new NotFoundException('Пользователь не найден');
      }

      const isSelf = id === actor.id;
      // Нельзя менять собственную роль или деактивировать себя (защита от эскалации/локаута).
      if (isSelf && dto.role !== undefined && dto.role !== existing.role) {
        throw new ForbiddenException('Нельзя изменить собственную роль');
      }
      if (isSelf && dto.isActive === false) {
        throw new ForbiddenException('Нельзя деактивировать собственную учётную запись');
      }
      // Учётку владельца может менять только владелец; роль OWNER назначает только владелец.
      if (existing.role === 'OWNER' && actor.role !== 'OWNER') {
        throw new ForbiddenException('Изменять учётную запись владельца может только владелец');
      }
      if (dto.role === 'OWNER' && actor.role !== 'OWNER') {
        throw new ForbiddenException('Роль «Владелец» может назначать только владелец');
      }

      const updated = await this.repo.update(id, {
        fullName: dto.fullName,
        role: dto.role,
        phone: dto.phone,
        isActive: dto.isActive,
      });

      await this.audit.log({ userId: actor.id, action: 'UPDATE', entity: 'User', entityId: id });
      return toUserDto(updated);
    });
  }

  async resetPassword(id: string, dto: ResetPasswordInput, actor: RequestUser): Promise<{ ok: true }> {
    return this.txHost.run(async () => {
      const existing = await this.repo.findById(id);
      if (!existing) {
        throw new NotFoundException('Пользователь не найден');
      }

      const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_SALT_ROUNDS);
      await this.repo.update(id, { passwordHash });

      await this.audit.log({ userId: actor.id, action: 'RESET_PASSWORD', entity: 'User', entityId: id });
      return { ok: true };
    });
  }

  async deactivate(id: string, actor: RequestUser): Promise<UserDto> {
    if (id === actor.id) {
      throw new ForbiddenException('Нельзя деактивировать собственную учётную запись');
    }

    return this.txHost.run(async () => {
      const existing = await this.repo.findById(id);
      if (!existing) {
        throw new NotFoundException('Пользователь не найден');
      }

      const updated = await this.repo.update(id, { isActive: false });
      await this.audit.log({ userId: actor.id, action: 'DEACTIVATE', entity: 'User', entityId: id });
      return toUserDto(updated);
    });
  }
}
