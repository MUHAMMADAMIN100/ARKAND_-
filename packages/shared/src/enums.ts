/**
 * Enum'ы домена. Значения строго совпадают с enum'ами Prisma (backend/prisma/schema.prisma).
 * Русские подписи — единый источник для UI и отчётов.
 */

export const Role = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  OPERATOR: 'OPERATOR',
  ASSISTANT_OPERATOR: 'ASSISTANT_OPERATOR',
  SALES_MANAGER: 'SALES_MANAGER',
  DUMP_TRUCK_DRIVER: 'DUMP_TRUCK_DRIVER',
  EXCAVATOR_DRIVER: 'EXCAVATOR_DRIVER',
  MECHANIC: 'MECHANIC',
  SUPPLY_MANAGER: 'SUPPLY_MANAGER',
  FINANCIER: 'FINANCIER',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const RoleLabel: Record<Role, string> = {
  OWNER: 'Владелец',
  ADMIN: 'Администратор',
  OPERATOR: 'Оператор',
  ASSISTANT_OPERATOR: 'Помощник оператора',
  SALES_MANAGER: 'Менеджер по продажам',
  DUMP_TRUCK_DRIVER: 'Шофёр самосвала',
  EXCAVATOR_DRIVER: 'Шофёр экскаватора',
  MECHANIC: 'Механик',
  SUPPLY_MANAGER: 'Снабженец',
  FINANCIER: 'Финансист',
};

export const Unit = {
  M3: 'M3',
  TON: 'TON',
} as const;
export type Unit = (typeof Unit)[keyof typeof Unit];

export const UnitLabel: Record<Unit, string> = {
  M3: 'м³',
  TON: 'т',
};

export const ProductKind = {
  RAW: 'RAW',
  FINISHED: 'FINISHED',
} as const;
export type ProductKind = (typeof ProductKind)[keyof typeof ProductKind];

export const ProductKindLabel: Record<ProductKind, string> = {
  RAW: 'Сырьё (горная масса)',
  FINISHED: 'Готовая продукция',
};

export const WarehouseType = {
  RAW: 'RAW',
  FINISHED: 'FINISHED',
} as const;
export type WarehouseType = (typeof WarehouseType)[keyof typeof WarehouseType];

export const ClientType = {
  EXTERNAL: 'EXTERNAL',
  INTERNAL: 'INTERNAL',
} as const;
export type ClientType = (typeof ClientType)[keyof typeof ClientType];

export const ClientTypeLabel: Record<ClientType, string> = {
  EXTERNAL: 'Внешний клиент',
  INTERNAL: 'Свой бизнес (холдинг)',
};

export const OrderStatus = {
  NEW: 'NEW',
  CONFIRMED: 'CONFIRMED',
  READY: 'READY',
  SHIPPING: 'SHIPPING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const OrderStatusLabel: Record<OrderStatus, string> = {
  NEW: 'Новый',
  CONFIRMED: 'Подтверждён',
  READY: 'Готов',
  SHIPPING: 'Отгружается',
  COMPLETED: 'Завершён',
  CANCELLED: 'Отменён',
};

export const PaymentMethod = {
  CASH: 'CASH',
  TRANSFER: 'TRANSFER',
  BARTER: 'BARTER',
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const PaymentMethodLabel: Record<PaymentMethod, string> = {
  CASH: 'Наличные',
  TRANSFER: 'Перевод',
  BARTER: 'Бартер (долг холдинга)',
};

export const DeliveryType = {
  DELIVERY: 'DELIVERY',
  PICKUP: 'PICKUP',
} as const;
export type DeliveryType = (typeof DeliveryType)[keyof typeof DeliveryType];

export const DeliveryTypeLabel: Record<DeliveryType, string> = {
  DELIVERY: 'Доставка (свой транспорт)',
  PICKUP: 'Самовывоз',
};

export const ShiftStatus = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
} as const;
export type ShiftStatus = (typeof ShiftStatus)[keyof typeof ShiftStatus];

export const ShiftStatusLabel: Record<ShiftStatus, string> = {
  OPEN: 'Открыта',
  CLOSED: 'Закрыта',
};

export const TalonStatus = {
  ISSUED: 'ISSUED',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const;
export type TalonStatus = (typeof TalonStatus)[keyof typeof TalonStatus];

export const TalonStatusLabel: Record<TalonStatus, string> = {
  ISSUED: 'Выдан',
  SHIPPED: 'Отгружен',
  DELIVERED: 'Доставлен',
  CANCELLED: 'Отменён',
};

export const VehicleType = {
  EXCAVATOR: 'EXCAVATOR',
  DUMP_TRUCK: 'DUMP_TRUCK',
  CRUSHER: 'CRUSHER',
  OTHER: 'OTHER',
} as const;
export type VehicleType = (typeof VehicleType)[keyof typeof VehicleType];

export const VehicleTypeLabel: Record<VehicleType, string> = {
  EXCAVATOR: 'Экскаватор',
  DUMP_TRUCK: 'Самосвал',
  CRUSHER: 'Дробилка',
  OTHER: 'Прочее',
};

export const TripType = {
  RAW_HAUL: 'RAW_HAUL',
  DELIVERY: 'DELIVERY',
} as const;
export type TripType = (typeof TripType)[keyof typeof TripType];

export const TripTypeLabel: Record<TripType, string> = {
  RAW_HAUL: 'Возка породы (карьер → дробилка)',
  DELIVERY: 'Доставка клиенту',
};

export const MaintenanceType = {
  REPAIR: 'REPAIR',
  SERVICE: 'SERVICE',
} as const;
export type MaintenanceType = (typeof MaintenanceType)[keyof typeof MaintenanceType];

export const MaintenanceTypeLabel: Record<MaintenanceType, string> = {
  REPAIR: 'Ремонт',
  SERVICE: 'ТО',
};

export const StockMovementType = {
  RAW_IN: 'RAW_IN',
  RAW_CONSUME: 'RAW_CONSUME',
  PRODUCTION_IN: 'PRODUCTION_IN',
  SHIPMENT_OUT: 'SHIPMENT_OUT',
  PROCUREMENT_IN: 'PROCUREMENT_IN',
  INVENTORY_ADJUST: 'INVENTORY_ADJUST',
  MANUAL_ADJUST: 'MANUAL_ADJUST',
} as const;
export type StockMovementType = (typeof StockMovementType)[keyof typeof StockMovementType];

export const StockMovementTypeLabel: Record<StockMovementType, string> = {
  RAW_IN: 'Приход породы (добыча)',
  RAW_CONSUME: 'Расход породы (в дробилку)',
  PRODUCTION_IN: 'Выпуск продукции',
  SHIPMENT_OUT: 'Отгрузка',
  PROCUREMENT_IN: 'Приход по закупке',
  INVENTORY_ADJUST: 'Корректировка (инвентаризация)',
  MANUAL_ADJUST: 'Ручная корректировка',
};

export const CashDirection = {
  INCOME: 'INCOME',
  EXPENSE: 'EXPENSE',
} as const;
export type CashDirection = (typeof CashDirection)[keyof typeof CashDirection];

export const CashDirectionLabel: Record<CashDirection, string> = {
  INCOME: 'Приход',
  EXPENSE: 'Расход',
};

export const CashCategory = {
  SALE: 'SALE',
  OTHER_INCOME: 'OTHER_INCOME',
  FUEL: 'FUEL',
  ELECTRICITY: 'ELECTRICITY',
  SALARY: 'SALARY',
  TAX: 'TAX',
  REPAIR: 'REPAIR',
  TRANSPORT: 'TRANSPORT',
  PROCUREMENT: 'PROCUREMENT',
  OTHER_EXPENSE: 'OTHER_EXPENSE',
} as const;
export type CashCategory = (typeof CashCategory)[keyof typeof CashCategory];

export const CashCategoryLabel: Record<CashCategory, string> = {
  SALE: 'Продажа продукции',
  OTHER_INCOME: 'Прочий приход',
  FUEL: 'Солярка',
  ELECTRICITY: 'Электроэнергия',
  SALARY: 'Зарплата',
  TAX: 'Налоги',
  REPAIR: 'Ремонт техники',
  TRANSPORT: 'Транспорт',
  PROCUREMENT: 'Закупка (снабжение)',
  OTHER_EXPENSE: 'Прочий расход',
};

export const CashStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  REJECTED: 'REJECTED',
} as const;
export type CashStatus = (typeof CashStatus)[keyof typeof CashStatus];

export const CashStatusLabel: Record<CashStatus, string> = {
  PENDING: 'Ожидает подтверждения',
  CONFIRMED: 'Подтверждено финансистом',
  REJECTED: 'Отклонено',
};

export const DebtEntryType = {
  SHIPMENT: 'SHIPMENT',
  REPAYMENT: 'REPAYMENT',
  OFFSET: 'OFFSET',
} as const;
export type DebtEntryType = (typeof DebtEntryType)[keyof typeof DebtEntryType];

export const DebtEntryTypeLabel: Record<DebtEntryType, string> = {
  SHIPMENT: 'Отгрузка (бартер → долг)',
  REPAYMENT: 'Возврат / оплата долга',
  OFFSET: 'Взаимозачёт',
};

export const PurchaseStatus = {
  NEW: 'NEW',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  PURCHASED: 'PURCHASED',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED',
} as const;
export type PurchaseStatus = (typeof PurchaseStatus)[keyof typeof PurchaseStatus];

export const PurchaseStatusLabel: Record<PurchaseStatus, string> = {
  NEW: 'Новая',
  PENDING_APPROVAL: 'Ждёт согласия владельцев',
  APPROVED: 'Согласована',
  REJECTED: 'Отклонена',
  PURCHASED: 'Закуплена',
  RECEIVED: 'Оприходована',
  CANCELLED: 'Отменена',
};

export const ApprovalDecision = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type ApprovalDecision = (typeof ApprovalDecision)[keyof typeof ApprovalDecision];

export const ApprovalDecisionLabel: Record<ApprovalDecision, string> = {
  PENDING: 'Ожидает',
  APPROVED: 'Добро',
  REJECTED: 'Нет',
};

export const InventoryScope = {
  FULL: 'FULL',
  PARTIAL: 'PARTIAL',
} as const;
export type InventoryScope = (typeof InventoryScope)[keyof typeof InventoryScope];

export const InventoryScopeLabel: Record<InventoryScope, string> = {
  FULL: 'Полная (весь склад)',
  PARTIAL: 'Частичная (группа/позиции)',
};

export const InventoryStatus = {
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type InventoryStatus = (typeof InventoryStatus)[keyof typeof InventoryStatus];

export const InventoryStatusLabel: Record<InventoryStatus, string> = {
  IN_PROGRESS: 'Идёт пересчёт',
  COMPLETED: 'Завершена',
  CANCELLED: 'Отменена',
};

/** Роли, играющие роль кассы (ЩЕБ: оператор и менеджер по продажам). */
export const CASHIER_ROLES: Role[] = [Role.OPERATOR, Role.SALES_MANAGER];

/** Роли с полным доступом ко всем данным. */
export const FULL_ACCESS_ROLES: Role[] = [Role.OWNER, Role.ADMIN];
