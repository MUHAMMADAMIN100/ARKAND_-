import { describe, expect, it } from 'vitest';
import {
  createTalonSchema,
  createCashTransactionSchema,
  createOrderSchema,
  startInventorySchema,
  createTripSchema,
} from '@sheben/shared';

describe('createTalonSchema — условная валидация доставки', () => {
  const base = { orderId: '00000000-0000-7000-8000-000000000000', productId: '00000000-0000-7000-8000-000000000001', quantity: 10 };

  it('доставка требует машину и водителя', () => {
    const r = createTalonSchema.safeParse({ ...base, deliveryType: 'DELIVERY' });
    expect(r.success).toBe(false);
    if (!r.success) {
      const fields = r.error.issues.map((i) => i.path.join('.'));
      expect(fields).toContain('vehicleId');
      expect(fields).toContain('driverId');
    }
  });

  it('доставка проходит с машиной и водителем', () => {
    const r = createTalonSchema.safeParse({
      ...base,
      deliveryType: 'DELIVERY',
      vehicleId: '00000000-0000-7000-8000-000000000002',
      driverId: '00000000-0000-7000-8000-000000000003',
    });
    expect(r.success).toBe(true);
  });

  it('самовывоз требует номер машины клиента', () => {
    const r = createTalonSchema.safeParse({ ...base, deliveryType: 'PICKUP' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path.join('.'))).toContain('clientVehiclePlate');
  });

  it('самовывоз проходит с номером машины', () => {
    const r = createTalonSchema.safeParse({ ...base, deliveryType: 'PICKUP', clientVehiclePlate: '01A123BC' });
    expect(r.success).toBe(true);
  });
});

describe('createCashTransactionSchema — касса', () => {
  const base = { amount: 100, date: '2026-07-16' };

  it('бартер в кассе запрещён (проводится через долги)', () => {
    const r = createCashTransactionSchema.safeParse({ ...base, direction: 'INCOME', method: 'BARTER', category: 'SALE' });
    expect(r.success).toBe(false);
  });

  it('приход с расходной категорией — ошибка', () => {
    const r = createCashTransactionSchema.safeParse({ ...base, direction: 'INCOME', method: 'CASH', category: 'FUEL' });
    expect(r.success).toBe(false);
  });

  it('расход с приходной категорией — ошибка', () => {
    const r = createCashTransactionSchema.safeParse({ ...base, direction: 'EXPENSE', method: 'CASH', category: 'SALE' });
    expect(r.success).toBe(false);
  });

  it('корректный приход', () => {
    const r = createCashTransactionSchema.safeParse({ ...base, direction: 'INCOME', method: 'CASH', category: 'SALE' });
    expect(r.success).toBe(true);
  });
});

describe('createOrderSchema — заказ', () => {
  it('требует хотя бы одну позицию', () => {
    const r = createOrderSchema.safeParse({
      clientId: '00000000-0000-7000-8000-000000000000',
      paymentMethod: 'CASH',
      deliveryType: 'PICKUP',
      items: [],
    });
    expect(r.success).toBe(false);
  });
});

describe('startInventorySchema — инвентаризация', () => {
  const wh = '00000000-0000-7000-8000-000000000000';
  it('частичная требует список позиций', () => {
    expect(startInventorySchema.safeParse({ warehouseId: wh, scope: 'PARTIAL' }).success).toBe(false);
  });
  it('полная не требует позиций', () => {
    expect(startInventorySchema.safeParse({ warehouseId: wh, scope: 'FULL' }).success).toBe(true);
  });
});

describe('createTripSchema — рейс', () => {
  const base = { vehicleId: '00000000-0000-7000-8000-000000000000', driverId: '00000000-0000-7000-8000-000000000001', date: '2026-07-16' };
  it('возка породы требует объём', () => {
    expect(createTripSchema.safeParse({ ...base, type: 'RAW_HAUL' }).success).toBe(false);
    expect(createTripSchema.safeParse({ ...base, type: 'RAW_HAUL', quantity: 20 }).success).toBe(true);
  });
  it('доставка требует талон', () => {
    expect(createTripSchema.safeParse({ ...base, type: 'DELIVERY' }).success).toBe(false);
  });
});
