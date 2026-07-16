import { Injectable, NotFoundException } from '@nestjs/common';
import { ClientType } from '@sheben/shared';
import type { ClientDto, CreateClientInput, Paginated, UpdateClientInput } from '@sheben/shared';
import { toClientDto } from './clients.mapper';
import { ClientsRepository, type ClientsListFilter } from './clients.repository';
import { buildPaginated, TransactionHost } from '../../common';

@Injectable()
export class ClientsService {
  constructor(
    private readonly repo: ClientsRepository,
    private readonly txHost: TransactionHost,
  ) {}

  async list(filter: ClientsListFilter): Promise<Paginated<ClientDto>> {
    const { items, total } = await this.repo.findMany(filter);

    const internalIds = items.filter((c) => c.type === ClientType.INTERNAL).map((c) => c.id);
    const debtByClient = await this.repo.getDebtBalances(internalIds);

    const dtos = items.map((c) => toClientDto(c, debtByClient.get(c.id)));
    return buildPaginated(dtos, total, filter.page, filter.pageSize);
  }

  async create(dto: CreateClientInput): Promise<ClientDto> {
    return this.txHost.run(async () => {
      const created = await this.repo.create({
        name: dto.name,
        type: dto.type,
        phone: dto.phone ?? null,
        note: dto.note ?? null,
      });
      // Новый клиент — долга ещё нет.
      return toClientDto(created, created.type === ClientType.INTERNAL ? 0 : undefined);
    });
  }

  async update(id: string, dto: UpdateClientInput): Promise<ClientDto> {
    return this.txHost.run(async () => {
      const existing = await this.repo.findById(id);
      if (!existing) {
        throw new NotFoundException('Клиент не найден');
      }

      const updated = await this.repo.update(id, {
        name: dto.name,
        type: dto.type,
        phone: dto.phone,
        note: dto.note,
        isActive: dto.isActive,
      });

      const debtBalance = updated.type === ClientType.INTERNAL ? await this.getDebtBalance(updated.id) : undefined;
      return toClientDto(updated, debtBalance);
    });
  }

  async deactivate(id: string): Promise<ClientDto> {
    return this.txHost.run(async () => {
      const existing = await this.repo.findById(id);
      if (!existing) {
        throw new NotFoundException('Клиент не найден');
      }

      const updated = await this.repo.update(id, { isActive: false });
      const debtBalance = updated.type === ClientType.INTERNAL ? await this.getDebtBalance(updated.id) : undefined;
      return toClientDto(updated, debtBalance);
    });
  }

  private async getDebtBalance(clientId: string): Promise<number> {
    const balances = await this.repo.getDebtBalances([clientId]);
    return balances.get(clientId) ?? 0;
  }
}
