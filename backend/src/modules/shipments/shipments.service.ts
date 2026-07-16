import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Role } from '@prisma/client';
import type { CreateTalonInput, CursorPage, TalonDto, TalonFilter } from '@sheben/shared';
import {
  AuditService,
  decodeCursor,
  DebtService,
  decToNum,
  encodeCursor,
  numToDec,
  round2,
  round3,
  StockService,
  TransactionHost,
} from '../../common';
import type { RequestUser } from '../../common';
import { mapTalonToDto } from './shipments.mapper';
import { ShipmentsRepository } from './shipments.repository';
import type { OrderWithItemsAndClient, TalonWithRelations } from './shipments.repository';

/** Роли водителей: видят и меняют только свои талоны (ABAC). */
const DRIVER_ROLES: Role[] = ['DUMP_TRUCK_DRIVER', 'EXCAVATOR_DRIVER'];

@Injectable()
export class ShipmentsService {
  constructor(
    private readonly repo: ShipmentsRepository,
    private readonly txHost: TransactionHost,
    private readonly stock: StockService,
    private readonly debt: DebtService,
    private readonly audit: AuditService,
  ) {}

  async list(filter: TalonFilter, user: RequestUser): Promise<CursorPage<TalonDto>> {
    // ABAC: водитель видит только свои талоны — принудительно переопределяем driverId.
    const effectiveFilter: TalonFilter = DRIVER_ROLES.includes(user.role)
      ? { ...filter, driverId: user.id }
      : filter;

    const cursor = decodeCursor(effectiveFilter.cursor);
    const rows = await this.repo.findMany(
      effectiveFilter,
      cursor ? { issuedAt: cursor.createdAt, id: cursor.id } : null,
    );

    const hasMore = rows.length > effectiveFilter.limit;
    const page = hasMore ? rows.slice(0, effectiveFilter.limit) : rows;
    const items = page.map(mapTalonToDto);
    const last = page[page.length - 1];
    const nextCursor = hasMore && last ? encodeCursor(last.issuedAt, last.id) : null;

    return { items, nextCursor };
  }

  async getById(id: string, user: RequestUser): Promise<TalonDto> {
    const talon = await this.repo.findById(id);
    if (!talon) throw new NotFoundException('Талон не найден');
    this.assertCanAccessOwnTalon(talon, user);
    return mapTalonToDto(talon);
  }

  async create(dto: CreateTalonInput, user: RequestUser): Promise<TalonDto> {
    const talonId = await this.txHost.run(async () => {
      const order = await this.repo.findOrderWithItemsAndClient(dto.orderId);
      if (!order) throw new NotFoundException('Заказ не найден');
      if (order.status === 'NEW') {
        throw new BadRequestException('Сначала подтвердите заказ');
      }
      if (order.status === 'CANCELLED' || order.status === 'COMPLETED') {
        throw new BadRequestException('Нельзя выдать талон на отменённый или завершённый заказ');
      }

      const orderItem = order.items.find((item) => item.productId === dto.productId);
      if (!orderItem) {
        throw new BadRequestException('Товар отсутствует в позициях заказа');
      }

      const alreadyShipped = await this.repo.shippedQtyForOrderProduct(dto.orderId, dto.productId);
      const remaining = round3(decToNum(orderItem.quantity) - alreadyShipped);
      if (dto.quantity > remaining) {
        throw new BadRequestException(`Превышен остаток по заказу: доступно ${remaining}`);
      }

      const price = dto.price ?? decToNum(orderItem.product.price);
      const amount = round2(dto.quantity * price);

      const talon = await this.repo.createTalon({
        orderId: dto.orderId,
        productId: dto.productId,
        quantity: numToDec(dto.quantity),
        price: numToDec(price),
        amount: numToDec(amount),
        deliveryType: dto.deliveryType,
        vehicleId: dto.vehicleId ?? null,
        driverId: dto.driverId ?? null,
        clientVehiclePlate: dto.clientVehiclePlate ?? null,
        note: dto.note ?? null,
        issuedById: user.id,
      });

      await this.stock.applyMovement({
        warehouseType: 'FINISHED',
        productId: dto.productId,
        type: 'SHIPMENT_OUT',
        qty: -dto.quantity,
        byUserId: user.id,
        refType: 'talon',
        refId: talon.id,
        allowNegative: false,
      });

      if (this.isBarterInternal(order)) {
        await this.debt.record({
          clientId: order.clientId,
          type: 'SHIPMENT',
          amount,
          date: new Date(),
          byUserId: user.id,
          refType: 'talon',
          refId: talon.id,
        });
      }

      // Первая отгрузка по заказу переводит его в статус "Отгружается".
      if (order.status !== 'SHIPPING') {
        await this.repo.setOrderStatus(order.id, 'SHIPPING');
      }

      return talon.id;
    });

    await this.audit.log({ userId: user.id, action: 'talon.issue', entity: 'Talon', entityId: talonId });
    return this.getById(talonId, user);
  }

  async ship(id: string, user: RequestUser): Promise<TalonDto> {
    const talon = await this.repo.findById(id);
    if (!talon) throw new NotFoundException('Талон не найден');
    if (talon.status !== 'ISSUED') {
      throw new BadRequestException('Отгрузить можно только выданный талон');
    }

    await this.repo.markShipped(id);
    await this.audit.log({ userId: user.id, action: 'talon.ship', entity: 'Talon', entityId: id });
    return this.getById(id, user);
  }

  async deliver(id: string, user: RequestUser): Promise<TalonDto> {
    const talon = await this.repo.findById(id);
    if (!talon) throw new NotFoundException('Талон не найден');
    this.assertCanAccessOwnTalon(talon, user);
    if (talon.status !== 'SHIPPED') {
      throw new BadRequestException('Доставленным можно отметить только отгруженный талон');
    }

    await this.repo.markDelivered(id);
    await this.audit.log({ userId: user.id, action: 'talon.deliver', entity: 'Talon', entityId: id });
    return this.getById(id, user);
  }

  async cancel(id: string, user: RequestUser): Promise<TalonDto> {
    await this.txHost.run(async () => {
      const talon = await this.repo.findById(id);
      if (!talon) throw new NotFoundException('Талон не найден');
      if (talon.status !== 'ISSUED' && talon.status !== 'SHIPPED') {
        throw new BadRequestException('Отменить можно только выданный или отгруженный талон');
      }

      // Возврат товара на склад.
      await this.stock.applyMovement({
        warehouseType: 'FINISHED',
        productId: talon.productId,
        type: 'SHIPMENT_OUT',
        qty: decToNum(talon.quantity),
        byUserId: user.id,
        refType: 'talon-cancel',
        refId: talon.id,
      });

      // Сторно бартерного долга, если он был начислен при выдаче.
      if (talon.order.paymentMethod === 'BARTER' && talon.order.client.type === 'INTERNAL') {
        await this.debt.record({
          clientId: talon.order.clientId,
          type: 'REPAYMENT',
          amount: -decToNum(talon.amount),
          date: new Date(),
          byUserId: user.id,
          refType: 'talon-cancel',
          refId: talon.id,
        });
      }

      await this.repo.markCancelled(id);

      // Если после отмены по заказу не осталось активных талонов — вернуть заказ из SHIPPING
      // в CONFIRMED (иначе заказ «завис» бы в отгрузке с нулевой фактической отгрузкой).
      if (talon.order.status === 'SHIPPING') {
        const active = await this.repo.countActiveTalonsForOrder(talon.orderId);
        if (active === 0) {
          await this.repo.setOrderStatus(talon.orderId, 'CONFIRMED');
        }
      }
    });

    await this.audit.log({ userId: user.id, action: 'talon.cancel', entity: 'Talon', entityId: id });
    return this.getById(id, user);
  }

  private isBarterInternal(order: OrderWithItemsAndClient): boolean {
    return order.paymentMethod === 'BARTER' && order.client.type === 'INTERNAL';
  }

  private assertCanAccessOwnTalon(talon: TalonWithRelations, user: RequestUser): void {
    if (DRIVER_ROLES.includes(user.role) && talon.driverId !== user.id) {
      throw new ForbiddenException('Доступен только собственный талон');
    }
  }
}
