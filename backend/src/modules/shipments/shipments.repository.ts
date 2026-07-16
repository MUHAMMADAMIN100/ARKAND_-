import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { DeliveryType, OrderStatus, TalonFilter } from '@sheben/shared';
import { endOfDayUtc, PrismaService, TransactionHost } from '../../common';

/** Талон вместе с заказом (+клиент), товаром, машиной, водителем и автором выдачи. */
const talonInclude = {
  order: { include: { client: true } },
  product: true,
  vehicle: true,
  driver: true,
  issuedBy: true,
} satisfies Prisma.TalonInclude;

export type TalonWithRelations = Prisma.TalonGetPayload<{ include: typeof talonInclude }>;

/** Заказ с позициями (+товар) и клиентом — для валидации выдачи талона. */
const orderWithItemsInclude = {
  items: { include: { product: true } },
  client: true,
} satisfies Prisma.OrderInclude;

export type OrderWithItemsAndClient = Prisma.OrderGetPayload<{ include: typeof orderWithItemsInclude }>;

export interface CreateTalonData {
  orderId: string;
  productId: string;
  quantity: Prisma.Decimal;
  price: Prisma.Decimal;
  amount: Prisma.Decimal;
  deliveryType: DeliveryType;
  vehicleId: string | null;
  driverId: string | null;
  clientVehiclePlate: string | null;
  note: string | null;
  issuedById: string;
}

@Injectable()
export class ShipmentsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly txHost: TransactionHost,
  ) {}

  private get db(): Prisma.TransactionClient {
    return this.txHost.tx as Prisma.TransactionClient;
  }

  private buildWhere(filter: TalonFilter): Prisma.TalonWhereInput {
    const where: Prisma.TalonWhereInput = {};
    if (filter.status) where.status = filter.status;
    if (filter.orderId) where.orderId = filter.orderId;
    if (filter.driverId) where.driverId = filter.driverId;
    if (filter.vehicleId) where.vehicleId = filter.vehicleId;
    if (filter.from || filter.to) {
      where.issuedAt = {
        ...(filter.from ? { gte: new Date(filter.from) } : {}),
        ...(filter.to ? { lte: endOfDayUtc(filter.to) } : {}),
      };
    }
    return where;
  }

  /**
   * Keyset-пагинация по issuedAt+id DESC. Берёт limit+1 записей, чтобы сервис мог
   * определить наличие следующей страницы без отдельного count-запроса.
   */
  async findMany(
    filter: TalonFilter,
    cursor: { issuedAt: Date; id: string } | null,
  ): Promise<TalonWithRelations[]> {
    const where = this.buildWhere(filter);
    const cursorWhere: Prisma.TalonWhereInput = cursor
      ? {
          OR: [
            { issuedAt: { lt: cursor.issuedAt } },
            { issuedAt: cursor.issuedAt, id: { lt: cursor.id } },
          ],
        }
      : {};

    return this.db.talon.findMany({
      where: { AND: [where, cursorWhere] },
      include: talonInclude,
      orderBy: [{ issuedAt: 'desc' }, { id: 'desc' }],
      take: filter.limit + 1,
    });
  }

  async findById(id: string): Promise<TalonWithRelations | null> {
    return this.db.talon.findUnique({ where: { id }, include: talonInclude });
  }

  async findOrderWithItemsAndClient(orderId: string): Promise<OrderWithItemsAndClient | null> {
    return this.db.order.findUnique({ where: { id: orderId }, include: orderWithItemsInclude });
  }

  /** Сумма quantity уже выданных по заказу+товару талонов (кроме отменённых). */
  async shippedQtyForOrderProduct(orderId: string, productId: string): Promise<number> {
    const agg = await this.db.talon.aggregate({
      where: { orderId, productId, status: { not: 'CANCELLED' } },
      _sum: { quantity: true },
    });
    return agg._sum.quantity ? Number(agg._sum.quantity.toString()) : 0;
  }

  async createTalon(data: CreateTalonData): Promise<{ id: string }> {
    return this.db.talon.create({ data, select: { id: true } });
  }

  async setOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
    await this.db.order.update({ where: { id: orderId }, data: { status } });
  }

  async markShipped(id: string): Promise<void> {
    await this.db.talon.update({ where: { id }, data: { status: 'SHIPPED', shippedAt: new Date() } });
  }

  async markDelivered(id: string): Promise<void> {
    await this.db.talon.update({ where: { id }, data: { status: 'DELIVERED', deliveredAt: new Date() } });
  }

  async markCancelled(id: string): Promise<void> {
    await this.db.talon.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  /** Число не-отменённых талонов по заказу (для возврата заказа из SHIPPING при отмене всех). */
  async countActiveTalonsForOrder(orderId: string): Promise<number> {
    return this.db.talon.count({ where: { orderId, status: { not: 'CANCELLED' } } });
  }
}
