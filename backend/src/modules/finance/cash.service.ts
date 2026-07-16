import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import {
  CASHIER_ROLES,
  uuidSchema,
  type CashDecisionInput,
  type CashFilter,
  type CashTransactionDto,
  type CreateCashTransactionInput,
  type Paginated,
} from '@sheben/shared';
import { AuditService, PrismaService, TransactionHost, buildPaginated, numToDec } from '../../common';
import type { RequestUser } from '../../common';
import { CashRepository } from './cash.repository';
import { toCashTransactionDto } from './cash.mapper';

/**
 * Касса (ЩЕБ-60, ЩЕБ-61). ABAC: кассир (OPERATOR/SALES_MANAGER) видит только свои операции,
 * FINANCIER/OWNER/ADMIN видят и подтверждают все.
 */
@Injectable()
export class CashService {
  constructor(
    private readonly repo: CashRepository,
    private readonly prisma: PrismaService,
    private readonly txHost: TransactionHost,
    private readonly audit: AuditService,
  ) {}

  async list(user: RequestUser, filter: CashFilter): Promise<Paginated<CashTransactionDto>> {
    const isCashier = CASHIER_ROLES.includes(user.role);
    const [entities, total] = await this.repo.findMany({
      direction: filter.direction,
      status: filter.status,
      category: filter.category,
      from: filter.from,
      to: filter.to,
      cashierId: isCashier ? user.id : undefined,
      page: filter.page,
      pageSize: filter.pageSize,
    });
    return buildPaginated(entities.map(toCashTransactionDto), total, filter.page, filter.pageSize);
  }

  async create(user: RequestUser, dto: CreateCashTransactionInput): Promise<CashTransactionDto> {
    if (dto.clientId) {
      const client = await this.prisma.client.findUnique({ where: { id: dto.clientId } });
      if (!client) throw new BadRequestException('Клиент не найден');
    }
    if (dto.orderId) {
      const order = await this.prisma.order.findUnique({ where: { id: dto.orderId } });
      if (!order) throw new BadRequestException('Заказ не найден');
    }

    const created = await this.txHost.run(() =>
      this.repo.create({
        direction: dto.direction,
        amount: numToDec(dto.amount),
        method: dto.method,
        category: dto.category,
        date: new Date(dto.date),
        clientId: dto.clientId ?? null,
        orderId: dto.orderId ?? null,
        cashierId: user.id,
        note: dto.note ?? null,
      }),
    );

    await this.audit.log({
      userId: user.id,
      action: 'CASH_CREATE',
      entity: 'CashTransaction',
      entityId: created.id,
    });
    return toCashTransactionDto(created);
  }

  async decide(user: RequestUser, id: string, dto: CashDecisionInput): Promise<CashTransactionDto> {
    this.assertUuid(id);
    const existing = await this.repo.findByIdOrThrow(id);
    if (existing.status !== 'PENDING') {
      throw new ConflictException('Операция уже обработана финансистом');
    }

    const nextStatus = dto.decision === 'CONFIRM' ? 'CONFIRMED' : 'REJECTED';
    const noteLabel = dto.decision === 'CONFIRM' ? 'Подтверждено' : 'Отклонено';
    const note = dto.note
      ? existing.note
        ? `${existing.note}\n${noteLabel}: ${dto.note}`
        : `${noteLabel}: ${dto.note}`
      : existing.note;

    const updated = await this.txHost.run(() =>
      this.repo.updateDecision(id, {
        status: nextStatus,
        confirmedById: user.id,
        confirmedAt: new Date(),
        note,
      }),
    );

    await this.audit.log({
      userId: user.id,
      action: dto.decision === 'CONFIRM' ? 'CASH_CONFIRM' : 'CASH_REJECT',
      entity: 'CashTransaction',
      entityId: id,
    });
    return toCashTransactionDto(updated);
  }

  private assertUuid(value: string): void {
    if (!uuidSchema.safeParse(value).success) {
      throw new BadRequestException('Некорректный идентификатор операции');
    }
  }
}
