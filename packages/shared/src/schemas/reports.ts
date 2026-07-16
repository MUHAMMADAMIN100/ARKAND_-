import { z } from 'zod';
import { dateStringSchema } from './common';

export const reportPeriodSchema = z.object({
  from: dateStringSchema,
  to: dateStringSchema,
});
export type ReportPeriod = z.infer<typeof reportPeriodSchema>;

/** ЩЕБ-70: заказы, выпуск по фракциям, остатки. */
export interface ProductionReportRow {
  productId: string;
  productName: string;
  unit: string;
  produced: number;
  shipped: number;
  stock: number;
}

/** ЩЕБ-71: солярка, электроэнергия, мощность. */
export interface ResourcesReport {
  fuelByVehicle: { vehicleId: string; vehicleName: string; liters: number; cost: number }[];
  fuelTotal: { liters: number; cost: number };
  electricity: { kwh: number; cost: number };
  /** Мощность (факт): выработка за период и в среднем за смену (ЩЕБ-32). */
  capacity: { totalOutput: number; shiftsCount: number; avgPerShift: number };
}

/** ЩЕБ-72: деньги и себестоимость. */
export interface FinanceReport {
  income: number;
  expense: number;
  expenseByCategory: { category: string; amount: number }[];
  profit: number;
  /** Себестоимость единицы = расходы ÷ выпуск (ЩЕБ-33). */
  unitCost: number;
  totalOutput: number;
  barterShipped: number;
  debtBalanceTotal: number;
}

export interface DashboardSummary {
  todayOutput: number;
  todayShipments: number;
  activeOrders: number;
  stockFinished: { productName: string; quantity: number; unit: string }[];
  pendingCash: number;
  pendingApprovals: number;
  monthIncome: number;
  monthExpense: number;
  debtTotal: number;
}
