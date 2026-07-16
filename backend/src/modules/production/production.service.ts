import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ProductKind, ShiftStatus, StockMovementType, WarehouseType } from '@prisma/client';
import type { CloseShiftInput, OpenShiftInput, Paginated, ProductionShiftDto, RecordOutputInput } from '@sheben/shared';
import { buildPaginated, decToNum, numToDec, round3, skipTake, StockService, TransactionHost } from '../../common';
import type { RequestUser } from '../../common';
import { toShiftDto } from './production.mapper';
import { ProductionRepository } from './production.repository';

export interface ShiftListFilter {
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}

/** Производственные смены и выпуск по фракциям. Изменение остатков — только через StockService.applyMovement. */
@Injectable()
export class ProductionService {
  constructor(
    private readonly repo: ProductionRepository,
    private readonly stock: StockService,
    private readonly txHost: TransactionHost,
  ) {}

  async listShifts(filter: ShiftListFilter): Promise<Paginated<ProductionShiftDto>> {
    const { skip, take } = skipTake(filter.page, filter.pageSize);
    const { items, total } = await this.repo.findMany({ from: filter.from, to: filter.to }, skip, take);
    return buildPaginated(items.map(toShiftDto), total, filter.page, filter.pageSize);
  }

  async getShiftById(id: string): Promise<ProductionShiftDto> {
    const shift = await this.repo.findById(id);
    if (!shift) throw new NotFoundException('Смена не найдена');
    return toShiftDto(shift);
  }

  async openShift(user: RequestUser, dto: OpenShiftInput): Promise<ProductionShiftDto> {
    const shift = await this.repo.create({
      date: new Date(dto.date),
      shiftNumber: dto.shiftNumber,
      operatorId: user.id,
      note: dto.note ?? null,
    });
    return toShiftDto(shift);
  }

  async recordOutput(shiftId: string, dto: RecordOutputInput, user: RequestUser): Promise<ProductionShiftDto> {
    return this.txHost.run(async () => {
      const shift = await this.repo.findStatus(shiftId);
      if (!shift) throw new NotFoundException('Смена не найдена');
      if (shift.status !== ShiftStatus.OPEN) throw new BadRequestException('Смена закрыта');

      const productIds = [...new Set(dto.outputs.map((entry) => entry.productId))];
      const kindById = await this.repo.findProductKinds(productIds);
      for (const productId of productIds) {
        const kind = kindById.get(productId);
        if (!kind) throw new BadRequestException('Товар (фракция) не найден');
        if (kind !== ProductKind.FINISHED) {
          throw new BadRequestException('Выпуск можно вносить только по готовой продукции');
        }
      }

      for (const entry of dto.outputs) {
        const existing = await this.repo.findOutput(shiftId, entry.productId);
        const previousQty = existing ? decToNum(existing.quantity) : 0;
        const delta = round3(entry.quantity - previousQty);

        // Выпуск перезаписывается (не суммируется), склад же корректируется на дельту.
        await this.repo.upsertOutput(shiftId, entry.productId, numToDec(entry.quantity));

        if (delta !== 0) {
          await this.stock.applyMovement({
            warehouseType: WarehouseType.FINISHED,
            productId: entry.productId,
            type: StockMovementType.PRODUCTION_IN,
            qty: delta,
            byUserId: user.id,
            refType: 'production_shift',
            refId: shiftId,
          });
        }
      }

      if (dto.rawConsumed && dto.rawConsumed > 0) {
        const rawProduct = await this.repo.findPrimaryRawProduct();
        if (!rawProduct) throw new BadRequestException('Сырьевая позиция (горная масса) не настроена');

        await this.repo.incrementRawConsumed(shiftId, numToDec(dto.rawConsumed));
        await this.stock.applyMovement({
          warehouseType: WarehouseType.RAW,
          productId: rawProduct.id,
          type: StockMovementType.RAW_CONSUME,
          qty: -dto.rawConsumed,
          byUserId: user.id,
          refType: 'production_shift',
          refId: shiftId,
          allowNegative: false,
        });
      }

      const updated = await this.repo.findById(shiftId);
      if (!updated) throw new NotFoundException('Смена не найдена');
      return toShiftDto(updated);
    });
  }

  async closeShift(shiftId: string, dto: CloseShiftInput): Promise<ProductionShiftDto> {
    return this.txHost.run(async () => {
      const shift = await this.repo.findStatus(shiftId);
      if (!shift) throw new NotFoundException('Смена не найдена');
      if (shift.status !== ShiftStatus.OPEN) throw new BadRequestException('Смена уже закрыта');

      await this.repo.close(shiftId, dto.note);

      const updated = await this.repo.findById(shiftId);
      if (!updated) throw new NotFoundException('Смена не найдена');
      return toShiftDto(updated);
    });
  }
}
