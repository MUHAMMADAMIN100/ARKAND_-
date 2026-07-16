import { useQuery } from '@tanstack/react-query';
import { dashboardKeys, fetchDashboard } from '../../entities/dashboard/api';
import { PageHeader, StatTile, Card, LoadingBlock, ErrorState, money, num } from '../../shared';
import { useAuth } from '../../shared/auth/useAuth';
import styles from './DashboardPage.module.css';

export function DashboardPage() {
  const { user, hasRole } = useAuth();
  const canSeeFinance = hasRole('OWNER', 'ADMIN', 'FINANCIER');
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: dashboardKeys.summary,
    queryFn: fetchDashboard,
  });

  return (
    <div>
      <PageHeader title={`Здравствуйте, ${user?.fullName?.split(' ')[0] ?? ''}`} subtitle="Сводка по щебёночному заводу" />

      {isLoading && <LoadingBlock />}
      {isError && <ErrorState onRetry={() => refetch()} />}

      {data && (
        <>
          <div className={styles.grid}>
            <StatTile label="Выпуск сегодня" value={num(data.todayOutput)} hint="м³" tone="primary" />
            <StatTile label="Отгрузок сегодня" value={num(data.todayShipments, 0)} tone="default" />
            <StatTile label="Активных заказов" value={num(data.activeOrders, 0)} tone="default" />
            {canSeeFinance && <StatTile label="Приход за месяц" value={money(data.monthIncome)} tone="success" />}
            {canSeeFinance && <StatTile label="Расход за месяц" value={money(data.monthExpense)} tone="danger" />}
            {canSeeFinance && <StatTile label="Долги холдинга" value={money(data.debtTotal)} tone={data.debtTotal > 0 ? 'danger' : 'default'} />}
            {data.pendingCash > 0 && <StatTile label="Касса ждёт подтверждения" value={num(data.pendingCash, 0)} tone="warning" />}
            {data.pendingApprovals > 0 && <StatTile label="Ждут согласия владельцев" value={num(data.pendingApprovals, 0)} tone="warning" />}
          </div>

          <Card className={styles.stockCard}>
            <h3 className={styles.cardTitle}>Остатки готовой продукции</h3>
            {data.stockFinished.length === 0 ? (
              <p className={styles.dim}>Нет данных по остаткам</p>
            ) : (
              <div className={styles.stockGrid}>
                {data.stockFinished.map((s) => (
                  <div key={s.productName} className={styles.stockItem}>
                    <span className={styles.stockName}>{s.productName}</span>
                    <span className={styles.stockQty}>
                      {num(s.quantity)} {s.unit === 'TON' ? 'т' : 'м³'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
