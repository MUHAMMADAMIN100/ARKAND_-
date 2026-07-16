import { Injectable } from '@nestjs/common';
import { Prisma, Role, User } from '@prisma/client';
import { skipTake, TransactionHost } from '../../common';

export interface UsersListFilter {
  role?: Role;
  search?: string;
  page: number;
  pageSize: number;
}

/** Доступ к пользователям через Prisma. Работает через активный транзакционный клиент (txHost.tx). */
@Injectable()
export class UsersRepository {
  constructor(private readonly txHost: TransactionHost) {}

  private get db(): Prisma.TransactionClient {
    return this.txHost.tx as Prisma.TransactionClient;
  }

  async findMany(filter: UsersListFilter): Promise<{ items: User[]; total: number }> {
    const where = this.buildWhere(filter);
    const { skip, take } = skipTake(filter.page, filter.pageSize);

    const [items, total] = await Promise.all([
      this.db.user.findMany({ where, orderBy: [{ createdAt: 'desc' }], skip, take }),
      this.db.user.count({ where }),
    ]);
    return { items, total };
  }

  async findById(id: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { id } });
  }

  async findByLogin(login: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { login } });
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.db.user.create({ data });
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.db.user.update({ where: { id }, data });
  }

  private buildWhere(filter: UsersListFilter): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {};
    if (filter.role) where.role = filter.role;

    const search = filter.search?.trim();
    if (search) {
      where.OR = [
        { login: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
      ];
    }
    return where;
  }
}
