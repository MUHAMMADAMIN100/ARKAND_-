import { Injectable, NotFoundException } from '@nestjs/common';
import { ApprovalDecision, Prisma, PurchaseStatus } from '@prisma/client';
import { PrismaService, TransactionHost, skipTake } from '../../common';

const PURCHASE_REQUEST_INCLUDE = {
  product: true,
  createdBy: true,
  approvals: { include: { owner: true }, orderBy: { id: 'asc' } },
} satisfies Prisma.PurchaseRequestInclude;

export type PurchaseRequestEntity = Prisma.PurchaseRequestGetPayload<{ include: typeof PURCHASE_REQUEST_INCLUDE }>;
export type OwnerApprovalEntity = PurchaseRequestEntity['approvals'][number];

export interface PurchaseRequestListFilter {
  status?: PurchaseStatus;
  page: number;
  pageSize: number;
}

/** Доступ к БД для заявок на закупку и согласований владельцев (ЩЕБ-41, ХОЛ-20…24, СНБ). */
@Injectable()
export class ProcurementRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly txHost: TransactionHost,
  ) {}

  private get db(): Prisma.TransactionClient {
    return this.txHost.tx as Prisma.TransactionClient;
  }

  async findMany(filter: PurchaseRequestListFilter): Promise<[PurchaseRequestEntity[], number]> {
    const where: Prisma.PurchaseRequestWhereInput = filter.status ? { status: filter.status } : {};
    const { skip, take } = skipTake(filter.page, filter.pageSize);
    const [items, total] = await Promise.all([
      this.db.purchaseRequest.findMany({
        where,
        include: PURCHASE_REQUEST_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.db.purchaseRequest.count({ where }),
    ]);
    return [items, total];
  }

  async findByIdOrThrow(id: string): Promise<PurchaseRequestEntity> {
    const entity = await this.db.purchaseRequest.findUnique({ where: { id }, include: PURCHASE_REQUEST_INCLUDE });
    if (!entity) throw new NotFoundException('Заявка на закупку не найдена');
    return entity;
  }

  async create(data: Prisma.PurchaseRequestUncheckedCreateInput): Promise<PurchaseRequestEntity> {
    return this.db.purchaseRequest.create({ data, include: PURCHASE_REQUEST_INCLUDE });
  }

  async update(id: string, data: Prisma.PurchaseRequestUncheckedUpdateInput): Promise<PurchaseRequestEntity> {
    return this.db.purchaseRequest.update({ where: { id }, data, include: PURCHASE_REQUEST_INCLUDE });
  }

  /** Владельцы холдинга — согласующие по крупным закупкам (ХОЛ-23: нужно согласие всех). */
  async findOwners(): Promise<{ id: string }[]> {
    return this.db.user.findMany({ where: { role: 'OWNER' }, select: { id: true } });
  }

  async createApprovals(requestId: string, ownerIds: string[]): Promise<void> {
    if (ownerIds.length === 0) return;
    await this.db.ownerApproval.createMany({
      data: ownerIds.map((ownerId) => ({ requestId, ownerId, decision: 'PENDING' as const })),
    });
  }

  async updateApproval(
    approvalId: string,
    decision: ApprovalDecision,
    note: string | null,
    decidedAt: Date,
  ): Promise<void> {
    await this.db.ownerApproval.update({ where: { id: approvalId }, data: { decision, note, decidedAt } });
  }

  async getSettingValue(key: string): Promise<Prisma.JsonValue | null> {
    const setting = await this.db.setting.findUnique({ where: { key } });
    return setting?.value ?? null;
  }
}
