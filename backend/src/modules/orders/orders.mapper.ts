import type { OrderDto, OrderItemDto } from '@sheben/shared';
import { decToNum, round2 } from '../../common';
import type { OrderWithRelations } from './orders.repository';

/** entity -> DTO. shippedMap: ключ `${orderId}:${productId}` -> уже отгружено по талонам. */
export function mapOrderToDto(order: OrderWithRelations, shippedMap: Map<string, number>): OrderDto {
  const items: OrderItemDto[] = order.items.map((item) => {
    const quantity = decToNum(item.quantity);
    const price = decToNum(item.price);
    return {
      id: item.id,
      productId: item.productId,
      productName: item.product.name,
      unit: item.product.unit,
      quantity,
      price,
      amount: round2(quantity * price),
      shippedQty: shippedMap.get(`${order.id}:${item.productId}`) ?? 0,
    };
  });

  const totalAmount = round2(items.reduce((sum, item) => sum + item.amount, 0));

  return {
    id: order.id,
    number: order.number,
    clientId: order.clientId,
    clientName: order.client.name,
    clientType: order.client.type,
    status: order.status,
    paymentMethod: order.paymentMethod,
    deliveryType: order.deliveryType,
    plannedDate: order.plannedDate ? order.plannedDate.toISOString().slice(0, 10) : null,
    note: order.note,
    totalAmount,
    items,
    createdById: order.createdById,
    createdByName: order.createdBy.fullName,
    createdAt: order.createdAt.toISOString(),
  };
}
