import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateOrderInput,
  OrderDto,
  OrderFilter,
  OrderItemInput,
  OrderStatus,
  OrderStatusChangeInput,
  Paginated,
  UpdateOrderInput,
} from '@sheben/shared';
import { AuditService, buildPaginated, numToDec, skipTake, TransactionHost } from '../../common';
import type { RequestUser } from '../../common';
import { mapOrderToDto } from './orders.mapper';
import { OrdersRepository } from './orders.repository';
import type { OrderItemWriteData } from './orders.repository';

/** Разрешённые переходы статуса заказа. CANCELLED достижим из любого состояния кроме COMPLETED. */
const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  NEW: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['READY', 'CANCELLED'],
  READY: ['SHIPPING', 'CANCELLED'],
  SHIPPING: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

const EDITABLE_STATUSES: OrderStatus[] = ['NEW', 'CONFIRMED'];

@Injectable()
export class OrdersService {
  constructor(
    private readonly repo: OrdersRepository,
    private readonly txHost: TransactionHost,
    private readonly audit: AuditService,
  ) {}

  async list(filter: OrderFilter): Promise<Paginated<OrderDto>> {
    const { skip, take } = skipTake(filter.page, filter.pageSize);
    const { orders, total } = await this.repo.findMany(filter, skip, take);
    const shippedMap = await this.repo.shippedQtyMap(orders.map((o) => o.id));
    const items = orders.map((order) => mapOrderToDto(order, shippedMap));
    return buildPaginated(items, total, filter.page, filter.pageSize);
  }

  async getById(id: string): Promise<OrderDto> {
    const order = await this.repo.findById(id);
    if (!order) throw new NotFoundException('Заказ не найден');
    const shippedMap = await this.repo.shippedQtyMap([order.id]);
    return mapOrderToDto(order, shippedMap);
  }

  async create(dto: CreateOrderInput, user: RequestUser): Promise<OrderDto> {
    const clientOk = await this.repo.clientExists(dto.clientId);
    if (!clientOk) throw new BadRequestException('Клиент не найден');

    const items = await this.buildItemsData(dto.items);

    const order = await this.txHost.run(() =>
      this.repo.createOrder({
        clientId: dto.clientId,
        paymentMethod: dto.paymentMethod,
        deliveryType: dto.deliveryType,
        plannedDate: dto.plannedDate ? new Date(dto.plannedDate) : null,
        note: dto.note ?? null,
        createdById: user.id,
        items,
      }),
    );

    await this.audit.log({ userId: user.id, action: 'order.create', entity: 'Order', entityId: order.id });
    return mapOrderToDto(order, new Map());
  }

  async update(id: string, dto: UpdateOrderInput, user: RequestUser): Promise<OrderDto> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Заказ не найден');
    if (!EDITABLE_STATUSES.includes(existing.status)) {
      throw new BadRequestException('Заказ можно менять только в статусах "Новый" или "Подтверждён"');
    }

    if (dto.clientId) {
      const clientOk = await this.repo.clientExists(dto.clientId);
      if (!clientOk) throw new BadRequestException('Клиент не найден');
    }

    let itemsData: OrderItemWriteData[] | undefined;
    if (dto.items) {
      itemsData = await this.buildItemsData(dto.items);
    }

    await this.txHost.run(async () => {
      await this.repo.updateHeader(id, {
        clientId: dto.clientId,
        paymentMethod: dto.paymentMethod,
        deliveryType: dto.deliveryType,
        plannedDate: dto.plannedDate ? new Date(dto.plannedDate) : undefined,
        note: dto.note,
      });
      if (itemsData) {
        await this.repo.replaceItems(id, itemsData);
      }
    });

    await this.audit.log({ userId: user.id, action: 'order.update', entity: 'Order', entityId: id });

    return this.getById(id);
  }

  async changeStatus(id: string, dto: OrderStatusChangeInput, user: RequestUser): Promise<OrderDto> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Заказ не найден');

    const allowed = ORDER_TRANSITIONS[existing.status];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(`Недопустимый переход статуса: ${existing.status} → ${dto.status}`);
    }

    await this.repo.updateStatus(id, dto.status);
    await this.audit.log({
      userId: user.id,
      action: 'order.status',
      entity: 'Order',
      entityId: id,
      payload: { from: existing.status, to: dto.status },
    });

    return this.getById(id);
  }

  async remove(id: string, user: RequestUser): Promise<{ ok: true }> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Заказ не найден');
    if (existing.status !== 'NEW') {
      throw new BadRequestException('Удалить можно только новый заказ');
    }

    await this.repo.deleteOrder(id);
    await this.audit.log({ userId: user.id, action: 'order.delete', entity: 'Order', entityId: id });
    return { ok: true };
  }

  /** Проверяет существование товаров и подставляет цену из каталога, если она не задана. */
  private async buildItemsData(items: OrderItemInput[]): Promise<OrderItemWriteData[]> {
    const productIds = [...new Set(items.map((item) => item.productId))];
    const products = await this.repo.findProductsByIds(productIds);
    if (products.size !== productIds.length) {
      throw new BadRequestException('Один или несколько товаров не найдены');
    }

    return items.map((item) => {
      const product = products.get(item.productId);
      if (!product) {
        throw new BadRequestException('Один или несколько товаров не найдены');
      }
      return {
        productId: item.productId,
        quantity: numToDec(item.quantity),
        price: item.price !== undefined ? numToDec(item.price) : product.price,
      };
    });
  }
}
