import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CashCategoryLabel, type CashCategory, type ReportPeriod } from '@sheben/shared';
import {
  reportsKeys,
  fetchProductionReport,
  fetchResourcesReport,
  fetchFinanceReport,
} from '../../entities/reports/api';
import {
  Card,
  DataTable,
  Field,
  Input,
  PageHeader,
  StatTile,
  LoadingBlock,
  money,
  num,
  type Column,
} from '../../shared';
import type { ProductionReportRow } from '@sheben/shared';
import styles from './ReportsPage.module.css';

function monthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ReportsPage() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const period: ReportPeriod = { from, to };

  const production = useQuery({ queryKey: reportsKeys.production(period), queryFn: () => fetchProductionReport(period) });
  const resources = useQuery({ queryKey: reportsKeys.resources(period), queryFn: () => fetchResourcesReport(period) });
  const finance = useQuery({ queryKey: reportsKeys.finance(period), queryFn: () => fetchFinanceReport(period) });

  const prodColumns: Column<ProductionReportRow>[] = [
    { key: 'name', header: 'Фракция', primary: true, render: (r) => r.productName },
    { key: 'produced', header: 'Произведено', align: 'right', render: (r) => num(r.produced) },
    { key: 'shipped', header: 'Отгружено', align: 'right', render: (r) => num(r.shipped) },
    { key: 'stock', header: 'Остаток', align: 'right', render: (r) => num(r.stock) },
  ];

  return (
    <div>
      <PageHeader title="Отчёты" subtitle="Аналитика для руководства" />

      <Card padded className={styles.period}>
        <Field label="С"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="По"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      </Card>

      {/* Финансы */}
      <h2 className={styles.section}>Финансы</h2>
      {finance.isLoading ? (
        <LoadingBlock />
      ) : finance.data ? (
        <>
          <div className={styles.grid}>
            <StatTile label="Приход" value={money(finance.data.income)} tone="success" />
            <StatTile label="Расход" value={money(finance.data.expense)} tone="danger" />
            <StatTile label="Прибыль" value={money(finance.data.profit)} tone={finance.data.profit >= 0 ? 'success' : 'danger'} />
            <StatTile label="Себестоимость ед." value={money(finance.data.unitCost)} hint="за м³" tone="primary" />
            <StatTile label="Бартер-отгрузки" value={money(finance.data.barterShipped)} />
            <StatTile label="Общий долг" value={money(finance.data.debtBalanceTotal)} tone={finance.data.debtBalanceTotal > 0 ? 'danger' : 'default'} />
          </div>
          {finance.data.expenseByCategory.length > 0 && (
            <Card padded className={styles.catCard}>
              <h3 className={styles.cardTitle}>Расходы по статьям</h3>
              {finance.data.expenseByCategory.map((c) => (
                <div key={c.category} className={styles.catRow}>
                  <span>{CashCategoryLabel[c.category as CashCategory] ?? c.category}</span>
                  <span className="tnum">{money(c.amount)}</span>
                </div>
              ))}
            </Card>
          )}
        </>
      ) : null}

      {/* Ресурсы */}
      <h2 className={styles.section}>Ресурсы и мощность</h2>
      {resources.isLoading ? (
        <LoadingBlock />
      ) : resources.data ? (
        <>
          <div className={styles.grid}>
            <StatTile label="Солярка (всего)" value={money(resources.data.fuelTotal.cost)} hint={`${num(resources.data.fuelTotal.liters)} л`} tone="warning" />
            <StatTile label="Электроэнергия" value={money(resources.data.electricity.cost)} hint={`${num(resources.data.electricity.kwh)} кВт·ч`} tone="warning" />
            <StatTile label="Выпуск за период" value={num(resources.data.capacity.totalOutput)} hint="м³" tone="primary" />
            <StatTile label="Смен" value={num(resources.data.capacity.shiftsCount, 0)} />
            <StatTile label="Мощность (факт)" value={num(resources.data.capacity.avgPerShift)} hint="м³/смена" tone="primary" />
          </div>
          {resources.data.fuelByVehicle.length > 0 && (
            <Card padded className={styles.catCard}>
              <h3 className={styles.cardTitle}>Солярка по машинам</h3>
              {resources.data.fuelByVehicle.map((v) => (
                <div key={v.vehicleId} className={styles.catRow}>
                  <span>{v.vehicleName}</span>
                  <span className="tnum">{num(v.liters)} л · {money(v.cost)}</span>
                </div>
              ))}
            </Card>
          )}
        </>
      ) : null}

      {/* Производство */}
      <h2 className={styles.section}>Производство по фракциям</h2>
      <Card padded>
        <DataTable
          columns={prodColumns}
          rows={production.data ?? []}
          rowKey={(r) => r.productId}
          loading={production.isLoading}
          emptyText="Нет данных за период"
        />
      </Card>
    </div>
  );
}
