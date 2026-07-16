import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { DeliveryType, OrderFilter, OrderStatus, PaymentMethod } from '@sheben/shared';
import { endOfDayUtc, PrismaService, TransactionHost } from '../../common';

/** Заказ вместе с клиентом, автором и позициями (+товар по каждой позиции). */
const orderInclude = {
  client: true,
  createdBy: true,
  items: { include: { product: true } },
} satisfies Prisma.OrderInclude;

export type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export interface OrderItemWriteData {
  productId: string;
  quantity: Prisma.Decimal;
  price: Prisma.Decimal;
}

export interface OrderHeaderWriteData {
  clientId?: string;
  paymentMethod?: PaymentMethod;
  deliveryType?: DeliveryType;
  plannedDate?: Date;
  note?: string;
}

@Injectable()
export class OrdersRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly txHost: TransactionHost,
  ) {}

  private get db(): Prisma.TransactionClient {
    return this.txHost.tx as Prisma.TransactionClient;
  }

  private buildWhere(filter: OrderFilter): Prisma.OrderWhereInput {
    const where: Prisma.OrderWhereInput = {};
    if (filter.status) where.status = filter.status;
    if (filter.clientId) where.clientId = filter.clientId;
    if (filter.paymentMethod) where.paymentMethod = filter.paymentMethod;
    if (filter.from || filter.to) {
      where.createdAt = {
        ...(filter.from ? { gte: new Date(filter.from) } : {}),
        ...(filter.to ? { lte: endOfDayUtc(filter.to) } : {}),
      };
    }
    if (filter.search) {
      const term = filter.search.trim();
      const asNumber = Number(term);
      where.OR = [
        { client: { name: { contains: term, mode: 'insensitive' } } },
        ...(term !== '' && Number.isFinite(asNumber) ? [{ number: asNumber }] : []),
      ];
    }
    return where;
  }

  async findMany(filter: OrderFilter, skip: number, take: number): Promise<{ orders: OrderWithRelations[]; total: number }> {
    const where = this.buildWhere(filter);
    const [orders, total] = await Promise.all([
      this.db.order.findMany({ where, include: orderInclude, orderBy: { createdAt: 'desc' }, skip, take }),
      this.db.order.count({ where }),
    ]);
    return { orders, total };
  }

  async findById(id: string): Promise<OrderWithRelations | null> {
    return this.db.order.findUnique({ where: { id }, include: orderInclude });
  }

  /** shippedQty по каждой позиции заказа: сумма quantity талонов (кроме отменённых), сгруппированная по товару. */
  async shippedQtyMap(orderIds: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (orderIds.length === 0) return map;

    const rows = await this.db.talon.groupBy({
      by: ['orderId', 'productId'],
      where: { orderId: { in: orderIds }, status: { not: 'CANCELLED' } },
      _sum: { quantity: true },
    });
    for (const row of rows) {
      const qty = row._sum.quantity ? Number(row._sum.quantity.toString()) : 0;
      map.set(`${row.orderId}:${row.productId}`, qty);
    }
    return map;
  }

  async clientExists(clientId: string): Promise<boolean> {
    const client = await this.db.client.findUnique({ where: { id: clientId }, select: { id: true } });
    return client !== null;
  }

  /** Товары по списку id (для проверки существования и цены-по-умолчанию). */
  async findProductsByIds(ids: string[]): Promise<Map<string, { id: string; price: Prisma.Decimal }>> {
    const map = new Map<string, { id: string; price: Prisma.Decimal }>();
    if (ids.length === 0) return map;
    const products = await this.db.product.findMany({ where: { id: { in: ids } }, select: { id: true, price: true } });
    for (const p of products) map.set(p.id, p);
    return map;
  }

  async createOrder(data: {
    clientId: string;
    paymentMethod: PaymentMethod;
    deliveryType: DeliveryType;
    plannedDate: Date | null;
    note: string | null;
    createdById: string;
    items: OrderItemWriteData[];
  }): Promise<OrderWithRelations> {
    return this.db.order.create({
      data: {
        clientId: data.clientId,
        paymentMethod: data.paymentMethod,
        deliveryType: data.deliveryType,
        plannedDate: data.plannedDate,
        note: data.note,
        createdById: data.createdById,
        items: { create: data.items },
      },
      include: orderInclude,
    });
  }

  async updateHeader(id: string, data: OrderHeaderWriteData): Promise<void> {
    await this.db.order.update({ where: { id }, data });
  }

  async replaceItems(orderId: string, items: OrderItemWriteData[]): Promise<void> {
    await this.db.orderItem.deleteMany({ where: { orderId } });
    if (items.length > 0) {
      await this.db.orderItem.createMany({ data: items.map((item) => ({ orderId, ...item })) });
    }
  }

  async updateStatus(id: string, status: OrderStatus): Promise<void> {
    await this.db.order.update({ where: { id }, data: { status } });
  }

  async deleteOrder(id: string): Promise<void> {
    await this.db.order.delete({ where: { id } });
  }
}
