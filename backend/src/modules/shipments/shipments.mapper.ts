import type { TalonDto } from '@sheben/shared';
import { decToNum } from '../../common';
import type { TalonWithRelations } from './shipments.repository';

/** entity -> DTO. */
export function mapTalonToDto(talon: TalonWithRelations): TalonDto {
  return {
    id: talon.id,
    number: talon.number,
    orderId: talon.orderId,
    orderNumber: talon.order.number,
    clientName: talon.order.client.name,
    productId: talon.productId,
    productName: talon.product.name,
    unit: talon.product.unit,
    quantity: decToNum(talon.quantity),
    price: decToNum(talon.price),
    amount: decToNum(talon.amount),
    deliveryType: talon.deliveryType,
    status: talon.status,
    vehicleId: talon.vehicleId,
    vehicleName: talon.vehicle ? talon.vehicle.name : null,
    driverId: talon.driverId,
    driverName: talon.driver ? talon.driver.fullName : null,
    clientVehiclePlate: talon.clientVehiclePlate,
    note: talon.note,
    issuedById: talon.issuedById,
    issuedByName: talon.issuedBy.fullName,
    issuedAt: talon.issuedAt.toISOString(),
    shippedAt: talon.shippedAt ? talon.shippedAt.toISOString() : null,
    deliveredAt: talon.deliveredAt ? talon.deliveredAt.toISOString() : null,
  };
}
