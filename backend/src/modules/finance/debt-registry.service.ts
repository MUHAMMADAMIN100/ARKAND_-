import { BadRequestException, Injectable } from '@nestjs/common';
import {
  uuidSchema,
  type CreateDebtEntryInput,
  type DebtBalanceDto,
  type DebtEntryDto,
  type Paginated,
} from '@sheben/shared';
import { DebtService, TransactionHost, buildPaginated, round2 } from '../../common';
import type { RequestUser } from '../../common';
import { DebtRegistryRepository } from './debt-registry.repository';
import { toDebtEntryDto } from './debt-registry.mapper';

export interface DebtRegistryDto {
  items: DebtBalanceDto[];
  totalBalance: number;
}

export interface DebtHistoryResult extends Paginated<DebtEntryDto> {
  balance: number;
}

/** Долги между бизнесами холдинга (ХОЛ-30…33): реестр, история, погашение/взаимозачёт. */
@Injectable()
export class DebtRegistryService {
  constructor(
    private readonly repo: DebtRegistryRepository,
    private readonly debtService: DebtService,
    private readonly txHost: TransactionHost,
  ) {}

  async getRegistry(): Promise<DebtRegistryDto> {
    const balances = await this.repo.listInternalBalances();
    const items: DebtBalanceDto[] = balances.map((b) => ({
      clientId: b.clientId,
      clientName: b.clientName,
      balance: b.balance,
      lastEntryAt: b.lastEntryAt ? b.lastEntryAt.toISOString() : null,
    }));
    const totalBalance = round2(items.reduce((sum, item) => sum + item.balance, 0));
    return { items, totalBalance };
  }

  async getHistory(clientId: string, page: number, pageSize: number): Promise<DebtHistoryResult> {
    this.assertUuid(clientId);
    await this.repo.findClientOrThrow(clientId);
    const [entries, total] = await this.repo.findEntries(clientId, page, pageSize);
    const balance = round2(await this.debtService.getBalance(clientId));
    return { ...buildPaginated(entries.map(toDebtEntryDto), total, page, pageSize), balance };
  }

  /** Погашение/взаимозачёт (ХОЛ-32). В БД пишется со знаком минус — уменьшает долг клиента. */
  async createEntry(user: RequestUser, dto: CreateDebtEntryInput): Promise<DebtEntryDto> {
    return this.txHost.run(async () => {
      const client = await this.repo.findClientOrThrow(dto.clientId);
      if (client.type !== 'INTERNAL') {
        throw new BadRequestException(
          'Долги ведутся только между собственными бизнесами холдинга (клиент должен быть INTERNAL)',
        );
      }

      await this.debtService.record({
        clientId: dto.clientId,
        type: dto.type,
        amount: -Math.abs(dto.amount),
        date: new Date(dto.date),
        byUserId: user.id,
        note: dto.note,
      });

      const created = await this.repo.findLatestEntryForUser(dto.clientId, user.id);
      return toDebtEntryDto(created);
    });
  }

  private assertUuid(value: string): void {
    if (!uuidSchema.safeParse(value).success) {
      throw new BadRequestException('Некорректный идентификатор клиента');
    }
  }
}
