import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, PurchaseStatus } from '@prisma/client';
import {
  uuidSchema,
  type CreatePurchaseRequestInput,
  type MarkPurchasedInput,
  type OwnerDecisionInput,
  type Paginated,
  type PurchaseRequestDto,
  type ReceivePurchaseInput,
  type UpdatePurchaseRequestInput,
} from '@sheben/shared';
import {
  AuditService,
  PrismaService,
  StockService,
  TransactionHost,
  buildPaginated,
  decToNum,
  numToDec,
} from '../../common';
import type { RequestUser } from '../../common';
import { ProcurementRepository } from './procurement.repository';
import { toPurchaseRequestDto } from './procurement.mapper';
import type { PurchaseRequestFilter } from './procurement.schemas';

const DEFAULT_LARGE_THRESHOLD = 5000;
const LARGE_THRESHOLD_SETTING_KEY = 'procurement.largeThreshold';

/** Заявки на закупку + согласование крупных закупок владельцами (ЩЕБ-41, ХОЛ-20…24, СНБ). */
@Injectable()
export class ProcurementService {
  constructor(
    private readonly repo: ProcurementRepository,
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
    private readonly txHost: TransactionHost,
    private readonly audit: AuditService,
  ) {}

  async list(filter: PurchaseRequestFilter): Promise<Paginated<PurchaseRequestDto>> {
    const [entities, total] = await this.repo.findMany({
      status: filter.status,
      page: filter.page,
      pageSize: filter.pageSize,
    });
    return buildPaginated(entities.map(toPurchaseRequestDto), total, filter.page, filter.pageSize);
  }

  async getOne(id: string): Promise<PurchaseRequestDto> {
    this.assertUuid(id);
    const entity = await this.repo.findByIdOrThrow(id);
    return toPurchaseRequestDto(entity);
  }

  /**
   * Создание заявки. isLarge = estimatedCost >= порог (Setting 'procurement.largeThreshold', по умолчанию 5000).
   * Крупная → PENDING_APPROVAL + по одному OwnerApproval на каждого владельца. Мелкая → сразу APPROVED.
   */
  async create(user: RequestUser, dto: CreatePurchaseRequestInput): Promise<PurchaseRequestDto> {
    if (dto.productId) {
      await this.assertProductExists(dto.productId);
    }

    const created = await this.txHost.run(async () => {
      const threshold = await this.getLargeThreshold();
      const isLarge = dto.estimatedCost !== undefined && dto.estimatedCost >= threshold;
      const status: PurchaseStatus = isLarge ? 'PENDING_APPROVAL' : 'APPROVED';

      const request = await this.repo.create({
        title: dto.title,
        productId: dto.productId ?? null,
        quantity: dto.quantity !== undefined ? numToDec(dto.quantity) : null,
        unit: dto.unit ?? null,
        estimatedCost: dto.estimatedCost !== undefined ? numToDec(dto.estimatedCost) : null,
        supplierName: dto.supplierName ?? null,
        note: dto.note ?? null,
        status,
        isLarge,
        createdById: user.id,
      });

      if (!isLarge) return request;

      const owners = await this.repo.findOwners();
      if (owners.length === 0) {
        throw new BadRequestException('В системе не настроены владельцы для согласования крупной закупки');
      }
      await this.repo.createApprovals(
        request.id,
        owners.map((owner) => owner.id),
      );
      return this.repo.findByIdOrThrow(request.id);
    });

    await this.audit.log({
      userId: user.id,
      action: 'PURCHASE_REQUEST_CREATE',
      entity: 'PurchaseRequest',
      entityId: created.id,
    });
    return toPurchaseRequestDto(created);
  }

  async update(id: string, dto: UpdatePurchaseRequestInput): Promise<PurchaseRequestDto> {
    this.assertUuid(id);
    const existing = await this.repo.findByIdOrThrow(id);
    if (existing.status !== 'NEW' && existing.status !== 'PENDING_APPROVAL') {
      throw new ConflictException(
        'Редактировать можно только новую заявку или заявку, ожидающую согласования владельцев',
      );
    }
    if (dto.productId) {
      await this.assertProductExists(dto.productId);
    }

    const data: Prisma.PurchaseRequestUncheckedUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.productId !== undefined) data.productId = dto.productId;
    if (dto.quantity !== undefined) data.quantity = numToDec(dto.quantity);
    if (dto.unit !== undefined) data.unit = dto.unit;
    if (dto.estimatedCost !== undefined) data.estimatedCost = numToDec(dto.estimatedCost);
    if (dto.supplierName !== undefined) data.supplierName = dto.supplierName;
    if (dto.note !== undefined) data.note = dto.note;

    const updated = await this.txHost.run(() => this.repo.update(id, data));
    return toPurchaseRequestDto(updated);
  }

  /** Решение владельца (ХОЛ-23): хоть один REJECTED → заявка REJECTED; все APPROVED → заявка APPROVED. */
  async decide(user: RequestUser, id: string, dto: OwnerDecisionInput): Promise<PurchaseRequestDto> {
    this.assertUuid(id);
    return this.txHost.run(async () => {
      const request = await this.repo.findByIdOrThrow(id);
      if (request.status !== 'PENDING_APPROVAL') {
        throw new ConflictException('Заявка не ожидает согласования владельцев');
      }
      const approval = request.approvals.find((a) => a.ownerId === user.id);
      if (!approval) {
        throw new ForbiddenException('Вы не входите в список согласующих владельцев по этой заявке');
      }
      if (approval.decision !== 'PENDING') {
        throw new ConflictException('Решение по этой заявке вами уже принято');
      }

      await this.repo.updateApproval(approval.id, dto.decision, dto.note ?? null, new Date());

      const refreshed = await this.repo.findByIdOrThrow(id);
      let nextStatus: PurchaseStatus | null = null;
      if (refreshed.approvals.some((a) => a.decision === 'REJECTED')) {
        nextStatus = 'REJECTED';
      } else if (refreshed.approvals.every((a) => a.decision === 'APPROVED')) {
        nextStatus = 'APPROVED';
      }

      const final = nextStatus ? await this.repo.update(id, { status: nextStatus }) : refreshed;

      await this.audit.log({
        userId: user.id,
        action: `PURCHASE_REQUEST_OWNER_${dto.decision}`,
        entity: 'PurchaseRequest',
        entityId: id,
      });
      return toPurchaseRequestDto(final);
    });
  }

  async markPurchased(user: RequestUser, id: string, dto: MarkPurchasedInput): Promise<PurchaseRequestDto> {
    this.assertUuid(id);
    return this.txHost.run(async () => {
      const request = await this.repo.findByIdOrThrow(id);
      if (request.status !== 'APPROVED') {
        throw new ConflictException('Отметить закупленной можно только согласованную заявку');
      }
      const updated = await this.repo.update(id, {
        status: 'PURCHASED',
        actualCost: numToDec(dto.actualCost),
        supplierName: dto.supplierName ?? request.supplierName,
      });
      await this.audit.log({
        userId: user.id,
        action: 'PURCHASE_REQUEST_PURCHASED',
        entity: 'PurchaseRequest',
        entityId: id,
      });
      return toPurchaseRequestDto(updated);
    });
  }

  /** Оприходование на склад (СНБ-05): при наличии productId+quantity — приход на склад RAW. */
  async receive(user: RequestUser, id: string, dto: ReceivePurchaseInput): Promise<PurchaseRequestDto> {
    this.assertUuid(id);
    return this.txHost.run(async () => {
      const request = await this.repo.findByIdOrThrow(id);
      if (request.status !== 'PURCHASED') {
        throw new ConflictException('Оприходовать можно только закупленную заявку');
      }

      if (request.productId) {
        const quantity = dto.quantity ?? (request.quantity ? decToNum(request.quantity) : undefined);
        if (!quantity || quantity <= 0) {
          throw new BadRequestException('Укажите количество для оприходования на склад');
        }
        await this.stockService.applyMovement({
          warehouseType: 'RAW',
          productId: request.productId,
          type: 'PROCUREMENT_IN',
          qty: quantity,
          byUserId: user.id,
          refType: 'PurchaseRequest',
          refId: request.id,
        });
      }

      const updated = await this.repo.update(id, { status: 'RECEIVED' });
      await this.audit.log({
        userId: user.id,
        action: 'PURCHASE_REQUEST_RECEIVED',
        entity: 'PurchaseRequest',
        entityId: id,
      });
      return toPurchaseRequestDto(updated);
    });
  }

  async cancel(user: RequestUser, id: string): Promise<PurchaseRequestDto> {
    this.assertUuid(id);
    return this.txHost.run(async () => {
      const request = await this.repo.findByIdOrThrow(id);
      if (request.status === 'RECEIVED') {
        throw new ConflictException('Оприходованную заявку нельзя отменить');
      }
      if (request.status === 'CANCELLED') {
        throw new ConflictException('Заявка уже отменена');
      }
      const updated = await this.repo.update(id, { status: 'CANCELLED' });
      await this.audit.log({
        userId: user.id,
        action: 'PURCHASE_REQUEST_CANCELLED',
        entity: 'PurchaseRequest',
        entityId: id,
      });
      return toPurchaseRequestDto(updated);
    });
  }

  private async assertProductExists(productId: string): Promise<void> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new BadRequestException('Товар не найден');
  }

  private async getLargeThreshold(): Promise<number> {
    const raw = await this.repo.getSettingValue(LARGE_THRESHOLD_SETTING_KEY);
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const amount = (raw as Record<string, unknown>).amount;
      if (typeof amount === 'number' && Number.isFinite(amount)) {
        return amount;
      }
    }
    return DEFAULT_LARGE_THRESHOLD;
  }

  private assertUuid(value: string): void {
    if (!uuidSchema.safeParse(value).success) {
      throw new BadRequestException('Некорректный идентификатор заявки');
    }
  }
}
