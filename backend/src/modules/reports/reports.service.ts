import { Injectable } from '@nestjs/common';
import type { Role } from '@prisma/client';
import type {
  DashboardSummary,
  FinanceReport,
  ProductionReportRow,
  ReportPeriod,
  ResourcesReport,
} from '@sheben/shared';
import { KyselyService, round2, round3 } from '../../common';

/** Роли, которым видны финансовые показатели сводки (доход/расход/долг). */
const FINANCE_VISIBLE_ROLES: Role[] = ['OWNER', 'ADMIN', 'FINANCIER'];

interface DayRange {
  start: Date;
  end: Date;
}

/**
 * Аналитика и отчёты руководству (ЩЕБ-70..72, ЩЕБ-32/33).
 * Вся логика — на Kysely (агрегаты/группировки поверх той же БД, что и Prisma).
 */
@Injectable()
export class ReportsService {
  constructor(private readonly db: KyselyService) {}

  /** Сводка для главного экрана. Финансовые поля — только управленческим/финансовым ролям. */
  async getDashboard(role: Role): Promise<DashboardSummary> {
    const canSeeFinance = FINANCE_VISIBLE_ROLES.includes(role);
    const today = this.dayRange(new Date());
    const month = this.monthRange(new Date());

    const [
      todayOutputRow,
      todayShipmentsRow,
      activeOrdersRow,
      stockFinishedRows,
      pendingCashRow,
      pendingApprovalsRow,
      monthIncomeRow,
      monthExpenseRow,
      debtTotalRow,
    ] = await Promise.all([
      this.db
        .selectFrom('production_outputs as po')
        .innerJoin('production_shifts as ps', 'ps.id', 'po.shift_id')
        .where('ps.date', '>=', today.start)
        .where('ps.date', '<', today.end)
        .select((eb) => eb.fn.sum<string | null>('po.quantity').as('total'))
        .executeTakeFirst(),
      this.db
        .selectFrom('talons')
        .where('issued_at', '>=', today.start)
        .where('issued_at', '<', today.end)
        .where('status', '!=', 'CANCELLED')
        .select((eb) => eb.fn.countAll<string>().as('count'))
        .executeTakeFirst(),
      this.db
        .selectFrom('orders')
        .where('status', 'in', ['NEW', 'CONFIRMED', 'READY', 'SHIPPING'])
        .select((eb) => eb.fn.countAll<string>().as('count'))
        .executeTakeFirst(),
      this.db
        .selectFrom('stock_items as si')
        .innerJoin('warehouses as w', 'w.id', 'si.warehouse_id')
        .innerJoin('products as p', 'p.id', 'si.product_id')
        .where('w.type', '=', 'FINISHED')
        .orderBy('p.sort_order')
        .select(['p.name as productName', 'si.quantity as quantity', 'p.unit as unit'])
        .execute(),
      this.db
        .selectFrom('cash_transactions')
        .where('status', '=', 'PENDING')
        .select((eb) => eb.fn.countAll<string>().as('count'))
        .executeTakeFirst(),
      this.db
        .selectFrom('purchase_requests')
        .where('status', '=', 'PENDING_APPROVAL')
        .select((eb) => eb.fn.countAll<string>().as('count'))
        .executeTakeFirst(),
      this.db
        .selectFrom('cash_transactions')
        .where('direction', '=', 'INCOME')
        .where('status', '=', 'CONFIRMED')
        .where('date', '>=', month.start)
        .where('date', '<', month.end)
        .select((eb) => eb.fn.sum<string | null>('amount').as('total'))
        .executeTakeFirst(),
      this.db
        .selectFrom('cash_transactions')
        .where('direction', '=', 'EXPENSE')
        .where('status', '=', 'CONFIRMED')
        .where('date', '>=', month.start)
        .where('date', '<', month.end)
        .select((eb) => eb.fn.sum<string | null>('amount').as('total'))
        .executeTakeFirst(),
      this.db
        .selectFrom('debt_entries')
        .select((eb) => eb.fn.sum<string | null>('amount').as('total'))
        .executeTakeFirst(),
    ]);

    return {
      todayOutput: round3(Number(todayOutputRow?.total ?? 0)),
      todayShipments: Number(todayShipmentsRow?.count ?? 0),
      activeOrders: Number(activeOrdersRow?.count ?? 0),
      stockFinished: stockFinishedRows.map((row) => ({
        productName: row.productName,
        quantity: round3(Number(row.quantity)),
        unit: row.unit,
      })),
      pendingCash: Number(pendingCashRow?.count ?? 0),
      pendingApprovals: Number(pendingApprovalsRow?.count ?? 0),
      // Финансы видны только управленческим/финансовым ролям; остальным — 0 (не раскрываем).
      monthIncome: canSeeFinance ? round2(Number(monthIncomeRow?.total ?? 0)) : 0,
      monthExpense: canSeeFinance ? round2(Number(monthExpenseRow?.total ?? 0)) : 0,
      debtTotal: canSeeFinance ? round2(Number(debtTotalRow?.total ?? 0)) : 0,
    };
  }

  /** ЩЕБ-70: выпуск/отгрузка/остаток по каждой фракции за период. */
  async getProductionReport(period: ReportPeriod): Promise<ProductionReportRow[]> {
    const { start, end } = this.periodRange(period);

    const rows = await this.db
      .selectFrom('products as p')
      .where('p.kind', '=', 'FINISHED')
      .leftJoin(
        (eb) =>
          eb
            .selectFrom('production_outputs as po')
            .innerJoin('production_shifts as ps', 'ps.id', 'po.shift_id')
            .where('ps.date', '>=', start)
            .where('ps.date', '<', end)
            .groupBy('po.product_id')
            .select(['po.product_id', (b) => b.fn.sum<string | null>('po.quantity').as('produced')])
            .as('prod'),
        (join) => join.onRef('prod.product_id', '=', 'p.id'),
      )
      .leftJoin(
        (eb) =>
          eb
            .selectFrom('talons')
            .where('issued_at', '>=', start)
            .where('issued_at', '<', end)
            .where('status', '!=', 'CANCELLED')
            .groupBy('product_id')
            .select(['product_id', (b) => b.fn.sum<string | null>('quantity').as('shipped')])
            .as('ship'),
        (join) => join.onRef('ship.product_id', '=', 'p.id'),
      )
      .leftJoin(
        (eb) =>
          eb
            .selectFrom('stock_items as si')
            .innerJoin('warehouses as w', 'w.id', 'si.warehouse_id')
            .where('w.type', '=', 'FINISHED')
            .select(['si.product_id', 'si.quantity as quantity'])
            .as('stk'),
        (join) => join.onRef('stk.product_id', '=', 'p.id'),
      )
      .orderBy('p.sort_order')
      .select([
        'p.id as productId',
        'p.name as productName',
        'p.unit as unit',
        'prod.produced as produced',
        'ship.shipped as shipped',
        'stk.quantity as stock',
      ])
      .execute();

    return rows.map((row) => ({
      productId: row.productId,
      productName: row.productName,
      unit: row.unit,
      produced: round3(Number(row.produced ?? 0)),
      shipped: round3(Number(row.shipped ?? 0)),
      stock: round3(Number(row.stock ?? 0)),
    }));
  }

  /** ЩЕБ-71/ЩЕБ-32: солярка, электроэнергия, мощность (факт) за период. */
  async getResourcesReport(period: ReportPeriod): Promise<ResourcesReport> {
    const { start, end } = this.periodRange(period);

    const [fuelByVehicleRows, fuelTotalRow, electricityRow, capacityRow, shiftsCountRow] = await Promise.all([
      this.db
        .selectFrom('fuel_logs as fl')
        .innerJoin('vehicles as v', 'v.id', 'fl.vehicle_id')
        .where('fl.date', '>=', start)
        .where('fl.date', '<', end)
        .groupBy(['v.id', 'v.name'])
        .orderBy('v.name')
        .select([
          'v.id as vehicleId',
          'v.name as vehicleName',
          (eb) => eb.fn.sum<string | null>('fl.liters').as('liters'),
          (eb) => eb.fn.sum<string | null>('fl.cost').as('cost'),
        ])
        .execute(),
      this.db
        .selectFrom('fuel_logs')
        .where('date', '>=', start)
        .where('date', '<', end)
        .select([
          (eb) => eb.fn.sum<string | null>('liters').as('liters'),
          (eb) => eb.fn.sum<string | null>('cost').as('cost'),
        ])
        .executeTakeFirst(),
      this.db
        .selectFrom('electricity_logs')
        .where('month', '>=', start)
        .where('month', '<', end)
        .select([
          (eb) => eb.fn.sum<string | null>('kwh').as('kwh'),
          (eb) => eb.fn.sum<string | null>('cost').as('cost'),
        ])
        .executeTakeFirst(),
      this.db
        .selectFrom('production_outputs as po')
        .innerJoin('production_shifts as ps', 'ps.id', 'po.shift_id')
        .where('ps.date', '>=', start)
        .where('ps.date', '<', end)
        .select((eb) => eb.fn.sum<string | null>('po.quantity').as('totalOutput'))
        .executeTakeFirst(),
      this.db
        .selectFrom('production_shifts')
        .where('date', '>=', start)
        .where('date', '<', end)
        .select((eb) => eb.fn.countAll<string>().as('count'))
        .executeTakeFirst(),
    ]);

    const totalOutput = Number(capacityRow?.totalOutput ?? 0);
    const shiftsCount = Number(shiftsCountRow?.count ?? 0);
    const avgPerShift = shiftsCount > 0 ? round3(totalOutput / shiftsCount) : 0;

    return {
      fuelByVehicle: fuelByVehicleRows.map((row) => ({
        vehicleId: row.vehicleId,
        vehicleName: row.vehicleName,
        liters: round3(Number(row.liters ?? 0)),
        cost: round2(Number(row.cost ?? 0)),
      })),
      fuelTotal: {
        liters: round3(Number(fuelTotalRow?.liters ?? 0)),
        cost: round2(Number(fuelTotalRow?.cost ?? 0)),
      },
      electricity: {
        kwh: round3(Number(electricityRow?.kwh ?? 0)),
        cost: round2(Number(electricityRow?.cost ?? 0)),
      },
      capacity: {
        totalOutput: round3(totalOutput),
        shiftsCount,
        avgPerShift,
      },
    };
  }

  /** ЩЕБ-72/ЩЕБ-33: деньги и себестоимость единицы продукции за период. */
  async getFinanceReport(period: ReportPeriod): Promise<FinanceReport> {
    const { start, end } = this.periodRange(period);

    const [incomeRow, expenseRow, expenseByCategoryRows, totalOutputRow, barterShippedRow, debtBalanceRow] =
      await Promise.all([
        this.db
          .selectFrom('cash_transactions')
          .where('direction', '=', 'INCOME')
          .where('status', '=', 'CONFIRMED')
          .where('date', '>=', start)
          .where('date', '<', end)
          .select((eb) => eb.fn.sum<string | null>('amount').as('total'))
          .executeTakeFirst(),
        this.db
          .selectFrom('cash_transactions')
          .where('direction', '=', 'EXPENSE')
          .where('status', '=', 'CONFIRMED')
          .where('date', '>=', start)
          .where('date', '<', end)
          .select((eb) => eb.fn.sum<string | null>('amount').as('total'))
          .executeTakeFirst(),
        this.db
          .selectFrom('cash_transactions')
          .where('direction', '=', 'EXPENSE')
          .where('status', '=', 'CONFIRMED')
          .where('date', '>=', start)
          .where('date', '<', end)
          .groupBy('category')
          .orderBy('category')
          .select(['category', (eb) => eb.fn.sum<string | null>('amount').as('amount')])
          .execute(),
        this.db
          .selectFrom('production_outputs as po')
          .innerJoin('production_shifts as ps', 'ps.id', 'po.shift_id')
          .where('ps.date', '>=', start)
          .where('ps.date', '<', end)
          .select((eb) => eb.fn.sum<string | null>('po.quantity').as('total'))
          .executeTakeFirst(),
        this.db
          .selectFrom('talons as t')
          .innerJoin('orders as o', 'o.id', 't.order_id')
          .where('o.payment_method', '=', 'BARTER')
          .where('t.status', '!=', 'CANCELLED')
          .where('t.issued_at', '>=', start)
          .where('t.issued_at', '<', end)
          .select((eb) => eb.fn.sum<string | null>('t.amount').as('total'))
          .executeTakeFirst(),
        this.db
          .selectFrom('debt_entries')
          .select((eb) => eb.fn.sum<string | null>('amount').as('total'))
          .executeTakeFirst(),
      ]);

    const income = Number(incomeRow?.total ?? 0);
    const expense = Number(expenseRow?.total ?? 0);
    const totalOutput = Number(totalOutputRow?.total ?? 0);

    return {
      income: round2(income),
      expense: round2(expense),
      expenseByCategory: expenseByCategoryRows.map((row) => ({
        category: row.category,
        amount: round2(Number(row.amount ?? 0)),
      })),
      profit: round2(income - expense),
      unitCost: totalOutput > 0 ? round2(expense / totalOutput) : 0,
      totalOutput: round3(totalOutput),
      barterShipped: round2(Number(barterShippedRow?.total ?? 0)),
      debtBalanceTotal: round2(Number(debtBalanceRow?.total ?? 0)),
    };
  }

  /** UTC-полночь дня, которому принадлежит `dateInput` (строка YYYY-MM-DD или Date). */
  private toDayStart(dateInput: string | Date): Date {
    const iso = typeof dateInput === 'string' ? dateInput : dateInput.toISOString();
    return new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
  }

  /** Границы суток [start, end) для одной даты (сравнение "< end" — чтобы захватить весь день). */
  private dayRange(dateInput: string | Date): DayRange {
    const start = this.toDayStart(dateInput);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { start, end };
  }

  /** Границы периода [from 00:00, to+1день) — включает весь день `to`. */
  private periodRange(period: ReportPeriod): DayRange {
    return {
      start: this.toDayStart(period.from),
      end: this.dayRange(period.to).end,
    };
  }

  /** Границы текущего календарного месяца (UTC) [start, end). */
  private monthRange(date: Date): DayRange {
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
    return { start, end };
  }
}
