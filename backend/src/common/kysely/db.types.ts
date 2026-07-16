import type {
  ApprovalDecision,
  CashCategory,
  CashDirection,
  CashStatus,
  ClientType,
  DebtEntryType,
  DeliveryType,
  InventoryScope,
  InventoryStatus,
  MaintenanceType,
  OrderStatus,
  PaymentMethod,
  ProductKind,
  PurchaseStatus,
  Role,
  ShiftStatus,
  StockMovementType,
  TalonStatus,
  TripType,
  Unit,
  VehicleType,
  WarehouseType,
} from '@prisma/client';
import type { ColumnType, Generated } from 'kysely';

type Numeric = ColumnType<string, string | number, string | number>;
type Timestamp = ColumnType<Date, Date | string, Date | string>;

/**
 * Ручные типы таблиц для Kysely (аналитика/отчёты).
 * Имена колонок — snake_case (как в БД через @map). Держать в синхроне со schema.prisma.
 */
export interface Database {
  users: {
    id: string;
    login: string;
    password_hash: string;
    full_name: string;
    role: Role;
    phone: string | null;
    is_active: boolean;
    created_at: Timestamp;
    updated_at: Timestamp;
  };
  products: {
    id: string;
    name: string;
    kind: ProductKind;
    unit: Unit;
    price: Numeric;
    min_stock: Numeric | null;
    is_active: boolean;
    sort_order: number;
    created_at: Timestamp;
    updated_at: Timestamp;
  };
  warehouses: {
    id: string;
    name: string;
    type: WarehouseType;
  };
  stock_items: {
    id: string;
    warehouse_id: string;
    product_id: string;
    quantity: Numeric;
    updated_at: Timestamp;
  };
  stock_movements: {
    id: string;
    warehouse_id: string;
    product_id: string;
    type: StockMovementType;
    qty: Numeric;
    ref_type: string | null;
    ref_id: string | null;
    by_user_id: string;
    comment: string | null;
    created_at: Timestamp;
  };
  clients: {
    id: string;
    name: string;
    type: ClientType;
    phone: string | null;
    note: string | null;
    is_active: boolean;
    created_at: Timestamp;
    updated_at: Timestamp;
  };
  orders: {
    id: string;
    number: Generated<number>;
    client_id: string;
    status: OrderStatus;
    payment_method: PaymentMethod;
    delivery_type: DeliveryType;
    planned_date: Timestamp | null;
    note: string | null;
    created_by_id: string;
    created_at: Timestamp;
    updated_at: Timestamp;
  };
  order_items: {
    id: string;
    order_id: string;
    product_id: string;
    quantity: Numeric;
    price: Numeric;
  };
  production_shifts: {
    id: string;
    date: Timestamp;
    shift_number: number;
    status: ShiftStatus;
    operator_id: string;
    raw_consumed: Numeric;
    note: string | null;
    closed_at: Timestamp | null;
    created_at: Timestamp;
  };
  production_outputs: {
    id: string;
    shift_id: string;
    product_id: string;
    quantity: Numeric;
  };
  talons: {
    id: string;
    number: Generated<number>;
    order_id: string;
    product_id: string;
    quantity: Numeric;
    price: Numeric;
    amount: Numeric;
    delivery_type: DeliveryType;
    status: TalonStatus;
    vehicle_id: string | null;
    driver_id: string | null;
    client_vehicle_plate: string | null;
    note: string | null;
    issued_by_id: string;
    issued_at: Timestamp;
    shipped_at: Timestamp | null;
    delivered_at: Timestamp | null;
  };
  vehicles: {
    id: string;
    name: string;
    type: VehicleType;
    plate: string | null;
    is_active: boolean;
    created_at: Timestamp;
  };
  trips: {
    id: string;
    vehicle_id: string;
    driver_id: string;
    type: TripType;
    date: Timestamp;
    quantity: Numeric | null;
    talon_id: string | null;
    note: string | null;
    entered_by_id: string;
    created_at: Timestamp;
  };
  maintenance_records: {
    id: string;
    vehicle_id: string;
    type: MaintenanceType;
    description: string;
    cost: Numeric;
    date: Timestamp;
    mechanic_id: string;
    created_at: Timestamp;
  };
  fuel_logs: {
    id: string;
    vehicle_id: string;
    liters: Numeric;
    cost: Numeric;
    date: Timestamp;
    by_user_id: string;
    note: string | null;
    created_at: Timestamp;
  };
  electricity_logs: {
    id: string;
    month: Timestamp;
    kwh: Numeric;
    cost: Numeric;
    note: string | null;
    by_user_id: string;
    created_at: Timestamp;
    updated_at: Timestamp;
  };
  cash_transactions: {
    id: string;
    number: Generated<number>;
    direction: CashDirection;
    amount: Numeric;
    method: PaymentMethod;
    category: CashCategory;
    status: CashStatus;
    date: Timestamp;
    client_id: string | null;
    order_id: string | null;
    ref_type: string | null;
    ref_id: string | null;
    cashier_id: string;
    confirmed_by_id: string | null;
    confirmed_at: Timestamp | null;
    note: string | null;
    created_at: Timestamp;
  };
  debt_entries: {
    id: string;
    client_id: string;
    type: DebtEntryType;
    amount: Numeric;
    date: Timestamp;
    ref_type: string | null;
    ref_id: string | null;
    note: string | null;
    by_user_id: string;
    created_at: Timestamp;
  };
  purchase_requests: {
    id: string;
    number: Generated<number>;
    title: string;
    product_id: string | null;
    quantity: Numeric | null;
    unit: Unit | null;
    estimated_cost: Numeric | null;
    actual_cost: Numeric | null;
    supplier_name: string | null;
    status: PurchaseStatus;
    is_large: boolean;
    is_auto: boolean;
    note: string | null;
    created_by_id: string;
    created_at: Timestamp;
    updated_at: Timestamp;
  };
  owner_approvals: {
    id: string;
    request_id: string;
    owner_id: string;
    decision: ApprovalDecision;
    note: string | null;
    decided_at: Timestamp | null;
  };
  inventories: {
    id: string;
    number: Generated<number>;
    warehouse_id: string;
    scope: InventoryScope;
    status: InventoryStatus;
    note: string | null;
    started_by_id: string;
    counted_by_id: string | null;
    started_at: Timestamp;
    completed_at: Timestamp | null;
  };
  inventory_items: {
    id: string;
    inventory_id: string;
    product_id: string;
    system_qty: Numeric;
    fact_qty: Numeric | null;
    diff_qty: Numeric | null;
    diff_amount: Numeric | null;
    explanation: string | null;
    responsible_id: string | null;
  };
  settings: {
    key: string;
    value: unknown;
    updated_at: Timestamp;
  };
  audit_logs: {
    id: string;
    user_id: string | null;
    action: string;
    entity: string;
    entity_id: string | null;
    payload: unknown;
    ip: string | null;
    created_at: Timestamp;
  };
}
