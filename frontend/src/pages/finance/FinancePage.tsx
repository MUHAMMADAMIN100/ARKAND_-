import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { FiCheck, FiX } from 'react-icons/fi';
import { zodForm as zodResolver } from '../../shared';
import {
  createCashTransactionSchema,
  createDebtEntrySchema,
  CashCategory,
  CashCategoryLabel,
  CashDirection,
  CashDirectionLabel,
  CashStatusLabel,
  DebtEntryType,
  DebtEntryTypeLabel,
  PaymentMethod,
  PaymentMethodLabel,
  type CashTransactionDto,
  type CreateCashTransactionInput,
  type CreateDebtEntryInput,
  type DebtBalanceDto,
} from '@sheben/shared';
import {
  financeKeys,
  fetchCashTransactions,
  createCashTransaction,
  decideCashTransaction,
  fetchDebtRegistry,
  fetchDebtHistory,
  createDebtEntry,
  type CashListParams,
} from '../../entities/finance/api';
import {
  Button,
  Card,
  DataTable,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  StatusChip,
  Pagination,
  money,
  formatDate,
  todayISO,
  useOptimisticMutation,
  type Column,
} from '../../shared';
import { useAuth } from '../../shared/auth/useAuth';

type Tab = 'cash' | 'debts';

const INCOME_CATEGORIES: CashCategory[] = ['SALE', 'OTHER_INCOME'];
const EXPENSE_CATEGORIES = Object.values(CashCategory).filter((c) => !INCOME_CATEGORIES.includes(c));

export function FinancePage() {
  const [tab, setTab] = useState<Tab>('cash');
  return (
    <div>
      <PageHeader title="Финансы" subtitle="Касса и взаиморасчёты" />
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Button variant={tab === 'cash' ? 'primary' : 'secondary'} size="sm" onClick={() => setTab('cash')}>Касса</Button>
        <Button variant={tab === 'debts' ? 'primary' : 'secondary'} size="sm" onClick={() => setTab('debts')}>Долги</Button>
      </div>
      {tab === 'cash' ? <CashTab /> : <DebtsTab />}
    </div>
  );
}

function CashTab() {
  const { hasRole } = useAuth();
  const canCreate = hasRole('OPERATOR', 'SALES_MANAGER');
  const canDecide = hasRole('FINANCIER', 'OWNER', 'ADMIN');
  const [page, setPage] = useState(1);
  const [modalDir, setModalDir] = useState<CashDirection | null>(null);

  const params: CashListParams = { page, pageSize: 25 };
  const { data, isLoading } = useQuery({ queryKey: financeKeys.cashList(params), queryFn: () => fetchCashTransactions(params) });

  const decideMut = useOptimisticMutation<CashTransactionDto, { id: string; decision: 'CONFIRM' | 'REJECT' }>({
    mutationFn: ({ id, decision }) => decideCashTransaction(id, { decision }),
    queryKeys: [financeKeys.all],
    successMessage: 'Готово',
  });

  const columns: Column<CashTransactionDto>[] = [
    { key: 'number', header: '№', primary: true, render: (c) => `№${c.number} · ${formatDate(c.date)}` },
    {
      key: 'dir',
      header: 'Направление',
      render: (c) => (
        <span style={{ color: c.direction === 'INCOME' ? 'var(--c-success)' : 'var(--c-danger)', fontWeight: 600 }}>
          {c.direction === 'INCOME' ? '+ ' : '− '}{CashDirectionLabel[c.direction]}
        </span>
      ),
    },
    { key: 'cat', header: 'Категория', render: (c) => CashCategoryLabel[c.category], hideOnMobile: true },
    { key: 'amount', header: 'Сумма', align: 'right', render: (c) => money(c.amount) },
    { key: 'status', header: 'Статус', render: (c) => <StatusChip value={c.status} label={CashStatusLabel[c.status]} /> },
    ...(canDecide
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right' as const,
            render: (c: CashTransactionDto) =>
              c.status === 'PENDING' ? (
                <span style={{ display: 'inline-flex', gap: 4 }}>
                  <Button size="sm" variant="success" aria-label="Подтвердить" onClick={() => decideMut.mutate({ id: c.id, decision: 'CONFIRM' })}><FiCheck /></Button>
                  <Button size="sm" variant="ghost" aria-label="Отклонить" onClick={() => decideMut.mutate({ id: c.id, decision: 'REJECT' })}><FiX /></Button>
                </span>
              ) : null,
          },
        ]
      : []),
  ];

  return (
    <Card padded>
      {canCreate && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <Button size="sm" variant="success" onClick={() => setModalDir(CashDirection.INCOME)}>+ Приход</Button>
          <Button size="sm" variant="danger" onClick={() => setModalDir(CashDirection.EXPENSE)}>+ Расход</Button>
        </div>
      )}
      <DataTable columns={columns} rows={data?.items ?? []} rowKey={(c) => c.id} loading={isLoading} emptyText="Нет операций" />
      {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />}
      {modalDir && <CashModal direction={modalDir} onClose={() => setModalDir(null)} />}
    </Card>
  );
}

function CashModal({ direction, onClose }: { direction: CashDirection; onClose: () => void }) {
  const isIncome = direction === 'INCOME';
  const categories = isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const { register, handleSubmit, formState: { errors } } = useForm<CreateCashTransactionInput>({
    resolver: zodResolver(createCashTransactionSchema),
    defaultValues: { direction, method: PaymentMethod.CASH, category: categories[0], date: todayISO() },
  });

  const createMut = useOptimisticMutation<CashTransactionDto, CreateCashTransactionInput>({
    mutationFn: createCashTransaction,
    queryKeys: [financeKeys.all],
    successMessage: 'Операция создана (ждёт подтверждения)',
    onDone: onClose,
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={isIncome ? 'Приход в кассу' : 'Расход из кассы'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button loading={createMut.isPending} onClick={handleSubmit((d) => createMut.mutate(d))}>Создать</Button>
        </>
      }
    >
      <Field label="Сумма, смн" error={errors.amount?.message} required>
        <Input type="number" step="0.01" {...register('amount', { valueAsNumber: true })} />
      </Field>
      <Field label="Способ оплаты" error={errors.method?.message} required>
        <Select
          options={[PaymentMethod.CASH, PaymentMethod.TRANSFER].map((m) => ({ value: m, label: PaymentMethodLabel[m] }))}
          {...register('method')}
        />
      </Field>
      <Field label="Категория" error={errors.category?.message} required>
        <Select options={categories.map((c) => ({ value: c, label: CashCategoryLabel[c] }))} {...register('category')} />
      </Field>
      <Field label="Дата" error={errors.date?.message} required>
        <Input type="date" {...register('date')} />
      </Field>
      <Field label="Примечание" error={errors.note?.message}>
        <Input {...register('note')} />
      </Field>
    </Modal>
  );
}

function DebtsTab() {
  const { hasRole } = useAuth();
  const canSettle = hasRole('FINANCIER', 'OWNER', 'ADMIN');
  const [selected, setSelected] = useState<DebtBalanceDto | null>(null);
  const { data, isLoading } = useQuery({ queryKey: financeKeys.debtRegistry, queryFn: fetchDebtRegistry });

  const columns: Column<DebtBalanceDto>[] = [
    { key: 'client', header: 'Клиент (свой бизнес)', primary: true, render: (d) => d.clientName },
    {
      key: 'balance',
      header: 'Баланс',
      align: 'right',
      render: (d) => <span style={{ color: d.balance > 0 ? 'var(--c-warning)' : 'var(--c-text)', fontWeight: 600 }}>{money(d.balance)}</span>,
    },
  ];

  return (
    <Card padded>
      <div style={{ marginBottom: 12, fontSize: 'var(--fs-sm)', color: 'var(--c-text-muted)' }}>
        Итого долг холдингу: <b style={{ color: 'var(--c-text)' }}>{money(data?.totalBalance ?? 0)}</b>
      </div>
      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(d) => d.clientId}
        loading={isLoading}
        emptyText="Долгов нет"
        onRowClick={(d) => setSelected(d)}
      />
      {selected && <DebtHistoryModal debt={selected} canSettle={canSettle} onClose={() => setSelected(null)} />}
    </Card>
  );
}

function DebtHistoryModal({ debt, canSettle, onClose }: { debt: DebtBalanceDto; canSettle: boolean; onClose: () => void }) {
  const [settleOpen, setSettleOpen] = useState(false);
  const { data } = useQuery({
    queryKey: financeKeys.debtHistory(debt.clientId, 1, 50),
    queryFn: () => fetchDebtHistory(debt.clientId, 1, 50),
  });

  const { register, handleSubmit, formState: { errors } } = useForm<CreateDebtEntryInput>({
    resolver: zodResolver(createDebtEntrySchema),
    defaultValues: { clientId: debt.clientId, type: DebtEntryType.REPAYMENT, date: todayISO() },
  });
  const settleMut = useOptimisticMutation<unknown, CreateDebtEntryInput>({
    mutationFn: createDebtEntry,
    queryKeys: [financeKeys.all],
    successMessage: 'Долг обновлён',
    onDone: () => { setSettleOpen(false); onClose(); },
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={debt.clientName}
      footer={canSettle ? <Button fullWidth onClick={() => setSettleOpen((v) => !v)}>Погашение / Взаимозачёт</Button> : undefined}
    >
      <div style={{ fontWeight: 700 }}>Текущий баланс: {money(data?.balance ?? debt.balance)}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(data?.items ?? []).map((e) => (
          <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-sm)', padding: '6px 0', borderTop: '1px solid var(--c-border)' }}>
            <span>{DebtEntryTypeLabel[e.type]} · {formatDate(e.date)}</span>
            <span className="tnum" style={{ color: e.amount > 0 ? 'var(--c-warning)' : 'var(--c-success)' }}>{money(e.amount)}</span>
          </div>
        ))}
      </div>

      {settleOpen && canSettle && (
        <div style={{ borderTop: '1px solid var(--c-border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Тип" error={errors.type?.message} required>
            <Select
              options={[DebtEntryType.REPAYMENT, DebtEntryType.OFFSET].map((t) => ({ value: t, label: DebtEntryTypeLabel[t] }))}
              {...register('type')}
            />
          </Field>
          <Field label="Сумма, смн" error={errors.amount?.message} required hint="Уменьшит долг">
            <Input type="number" step="0.01" {...register('amount', { valueAsNumber: true })} />
          </Field>
          <Field label="Дата" error={errors.date?.message} required>
            <Input type="date" {...register('date')} />
          </Field>
          <Button loading={settleMut.isPending} onClick={handleSubmit((d) => settleMut.mutate(d))}>Провести</Button>
        </div>
      )}
    </Modal>
  );
}
