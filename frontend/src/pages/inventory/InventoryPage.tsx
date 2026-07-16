import { useEffect, useState } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { warehouseKeys } from '../../entities/warehouse/api';
import { useForm, useWatch, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { zodForm as zodResolver } from '../../shared';
import {
  completeInventorySchema,
  InventoryScope,
  InventoryScopeLabel,
  InventoryStatus,
  InventoryStatusLabel,
  startInventorySchema,
  submitCountsSchema,
  type CompleteInventoryInput,
  type InventoryDto,
  type InventoryItemDto,
  type Paginated,
  type StartInventoryInput,
  type StockItemDto,
  type SubmitCountsInput,
  type UserDto,
  type WarehouseDto,
} from '@sheben/shared';
import {
  cancelInventory,
  completeInventory,
  fetchInventories,
  fetchInventory,
  fetchResponsibleUsers,
  fetchWarehouseStockForInventory,
  fetchWarehousesForInventory,
  inventoryKeys,
  startInventory,
  submitCounts,
  type InventoryListParams,
} from '../../entities/inventory/api';
import {
  Button,
  Card,
  DataTable,
  Field,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Select,
  StatusChip,
  Textarea,
  Toolbar,
  money,
  qty,
  formatDateTime,
  useOptimisticMutation,
  type Column,
} from '../../shared';
import { useAuth } from '../../shared/auth/useAuth';
import styles from './InventoryPage.module.css';

const PAGE_SIZE = 10;

export function InventoryPage() {
  const { user, hasRole } = useAuth();
  const canStart = hasRole('SUPPLY_MANAGER', 'OWNER', 'ADMIN');
  const canManage = hasRole('OPERATOR', 'SUPPLY_MANAGER', 'OWNER', 'ADMIN');

  const [status, setStatus] = useState<InventoryStatus | ''>('');
  const [page, setPage] = useState(1);
  const [startOpen, setStartOpen] = useState(false);
  const [selected, setSelected] = useState<InventoryDto | null>(null);

  const listParams: InventoryListParams = { status, page, pageSize: PAGE_SIZE };
  const listKey = inventoryKeys.list(listParams);

  const { data, isLoading } = useQuery({
    queryKey: listKey,
    queryFn: () => fetchInventories(listParams),
    placeholderData: keepPreviousData,
  });

  const warehousesQuery = useQuery({
    queryKey: ['warehouses', 'forInventory'] as const,
    queryFn: fetchWarehousesForInventory,
  });

  const startMut = useOptimisticMutation<InventoryDto, StartInventoryInput, Paginated<InventoryDto>>({
    mutationFn: startInventory,
    queryKeys: [listKey, inventoryKeys.all],
    updater: (old, vars) => {
      if (!old) return old;
      if (page !== 1 || (status && status !== InventoryStatus.IN_PROGRESS)) return old;
      const warehouseName = warehousesQuery.data?.find((w) => w.id === vars.warehouseId)?.name ?? '—';
      const tmp: InventoryDto = {
        id: `tmp-${Date.now()}`,
        number: 0,
        warehouseId: vars.warehouseId,
        warehouseName,
        scope: vars.scope,
        status: InventoryStatus.IN_PROGRESS,
        items: [],
        startedById: user?.id ?? '',
        startedByName: user?.fullName ?? '',
        countedById: null,
        countedByName: null,
        note: vars.note ?? null,
        startedAt: new Date().toISOString(),
        completedAt: null,
      };
      return { ...old, total: old.total + 1, items: [tmp, ...old.items].slice(0, old.pageSize) };
    },
    successMessage: 'Инвентаризация запущена',
    onDone: () => setStartOpen(false),
  });

  const columns: Column<InventoryDto>[] = [
    { key: 'number', header: '№', primary: true, render: (row) => `№${row.number}` },
    { key: 'warehouse', header: 'Склад', render: (row) => row.warehouseName },
    { key: 'scope', header: 'Объём', render: (row) => InventoryScopeLabel[row.scope] },
    {
      key: 'status',
      header: 'Статус',
      render: (row) => <StatusChip value={row.status} label={InventoryStatusLabel[row.status]} />,
    },
    { key: 'startedAt', header: 'Дата старта', render: (row) => formatDateTime(row.startedAt) },
    { key: 'startedBy', header: 'Кто начал', render: (row) => row.startedByName },
  ];

  return (
    <div>
      <PageHeader
        title="Инвентаризация"
        subtitle="Плановый и внеплановый пересчёт остатков склада"
        actions={canStart && <Button onClick={() => setStartOpen(true)}>+ Запустить</Button>}
      />

      <Toolbar>
        <Field label="Статус" className={styles.filters}>
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as InventoryStatus | '');
              setPage(1);
            }}
            options={[
              { value: '', label: 'Все статусы' },
              ...Object.values(InventoryStatus).map((s) => ({ value: s, label: InventoryStatusLabel[s] })),
            ]}
          />
        </Field>
      </Toolbar>

      <Card padded={false}>
        <div style={{ padding: 12 }}>
          <DataTable
            columns={columns}
            rows={data?.items ?? []}
            rowKey={(r) => r.id}
            loading={isLoading}
            emptyText="Инвентаризаций пока нет"
            onRowClick={(row) => setSelected(row)}
            footer={
              data && data.total > 0 ? (
                <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />
              ) : undefined
            }
          />
        </div>
      </Card>

      {startOpen && (
        <StartInventoryModal
          warehouses={warehousesQuery.data ?? []}
          onClose={() => setStartOpen(false)}
          onSubmit={(input) => startMut.mutate(input)}
          saving={startMut.isPending}
        />
      )}

      {selected && (
        <InventoryDetailModal
          id={selected.id}
          initialInventory={selected}
          canManage={canManage}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function diffToneClass(diff: number | null): string | undefined {
  if (diff === null || diff === 0) return styles.diffNeutral;
  return diff < 0 ? styles.diffNegative : styles.diffPositive;
}

function StartInventoryModal({
  warehouses,
  onClose,
  onSubmit,
  saving,
}: {
  warehouses: WarehouseDto[];
  onClose: () => void;
  onSubmit: (input: StartInventoryInput) => void;
  saving: boolean;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<StartInventoryInput>({
    resolver: zodResolver(startInventorySchema),
    defaultValues: { warehouseId: '', scope: InventoryScope.FULL, productIds: [] },
  });

  const warehouseId = watch('warehouseId');
  const scope = watch('scope');

  useEffect(() => {
    setValue('productIds', []);
  }, [warehouseId, setValue]);

  const stockQuery = useQuery({
    queryKey: ['warehouse', 'stockForInventory', warehouseId] as const,
    queryFn: () => fetchWarehouseStockForInventory(warehouseId),
    enabled: Boolean(warehouseId) && scope === InventoryScope.PARTIAL,
  });

  const stockItems: StockItemDto[] = stockQuery.data ?? [];

  return (
    <Modal
      open
      onClose={onClose}
      title="Запустить инвентаризацию"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleSubmit(onSubmit)} loading={saving}>
            Запустить
          </Button>
        </>
      }
    >
      <Field label="Склад" error={errors.warehouseId?.message} required>
        <Select
          placeholder="Выберите склад"
          options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
          {...register('warehouseId')}
        />
      </Field>
      <Field label="Объём инвентаризации" error={errors.scope?.message} required>
        <Select
          options={Object.values(InventoryScope).map((s) => ({ value: s, label: InventoryScopeLabel[s] }))}
          {...register('scope')}
        />
      </Field>
      {scope === InventoryScope.PARTIAL && (
        <Field label="Позиции для пересчёта" error={errors.productIds?.message} required>
          {!warehouseId ? (
            <p className={styles.hintText}>Сначала выберите склад</p>
          ) : stockQuery.isLoading ? (
            <p className={styles.hintText}>Загрузка позиций…</p>
          ) : stockItems.length === 0 ? (
            <p className={styles.hintText}>На складе нет позиций</p>
          ) : (
            <div className={styles.checkList}>
              {stockItems.map((s) => (
                <label key={s.productId} className={styles.checkItem}>
                  <input type="checkbox" value={s.productId} {...register('productIds')} />
                  <span>{s.productName}</span>
                  <span className={styles.checkQty}>{qty(s.quantity, s.unit)}</span>
                </label>
              ))}
            </div>
          )}
        </Field>
      )}
      <Field label="Комментарий" error={errors.note?.message} hint="Необязательно">
        <Textarea rows={2} placeholder="Причина внеплановой инвентаризации и т.п." {...register('note')} />
      </Field>
    </Modal>
  );
}

function InventoryDetailModal({
  id,
  initialInventory,
  canManage,
  onClose,
}: {
  id: string;
  initialInventory: InventoryDto;
  canManage: boolean;
  onClose: () => void;
}) {
  const [completing, setCompleting] = useState(false);
  const qc = useQueryClient();

  const { data: inventory } = useQuery({
    queryKey: inventoryKeys.detail(id),
    queryFn: () => fetchInventory(id),
    initialData: initialInventory,
  });

  const usersQuery = useQuery({
    queryKey: ['users', 'forInventory'] as const,
    queryFn: fetchResponsibleUsers,
    enabled: canManage,
  });
  const users: UserDto[] = usersQuery.data?.items ?? [];

  const countMut = useOptimisticMutation<InventoryDto, SubmitCountsInput, InventoryDto>({
    mutationFn: (input) => submitCounts(id, input),
    queryKeys: [inventoryKeys.detail(id)],
    updater: (old, vars) => {
      if (!old) return old;
      const factByItem = new Map(vars.counts.map((c) => [c.itemId, c.factQty]));
      return {
        ...old,
        items: old.items.map((it) => {
          const fact = factByItem.get(it.id);
          if (fact === undefined) return it;
          return { ...it, factQty: fact, diffQty: fact - it.systemQty };
        }),
      };
    },
    successMessage: 'Факт пересчёта сохранён',
  });

  const completeMut = useOptimisticMutation<InventoryDto, CompleteInventoryInput, InventoryDto>({
    mutationFn: (input) => completeInventory(id, input),
    queryKeys: [inventoryKeys.detail(id), inventoryKeys.all],
    updater: (old, vars) => {
      if (!old) return old;
      const shortageByItem = new Map((vars.shortages ?? []).map((s) => [s.itemId, s]));
      return {
        ...old,
        status: InventoryStatus.COMPLETED,
        completedAt: new Date().toISOString(),
        items: old.items.map((it) => {
          const s = shortageByItem.get(it.id);
          if (!s) return it;
          const responsible = users.find((u) => u.id === s.responsibleId);
          return {
            ...it,
            explanation: s.explanation,
            responsibleId: s.responsibleId,
            responsibleName: responsible?.fullName ?? null,
          };
        }),
      };
    },
    successMessage: 'Инвентаризация завершена',
    onDone: () => {
      // Завершение корректирует остатки (INVENTORY_ADJUST) — обновляем склад.
      void qc.invalidateQueries({ queryKey: warehouseKeys.all });
      onClose();
    },
  });

  const cancelMut = useOptimisticMutation<InventoryDto, void, InventoryDto>({
    mutationFn: () => cancelInventory(id),
    queryKeys: [inventoryKeys.detail(id), inventoryKeys.all],
    updater: (old) => (old ? { ...old, status: InventoryStatus.CANCELLED } : old),
    successMessage: 'Инвентаризация отменена',
    onDone: () => onClose(),
  });

  if (!inventory) return null;

  const isInProgress = inventory.status === InventoryStatus.IN_PROGRESS;
  const editable = isInProgress && canManage;

  const uncountedItems = inventory.items.filter((it) => it.factQty === null);
  const shortageItems = inventory.items.filter((it) => it.diffQty !== null && it.diffQty < 0);
  const surplusItems = inventory.items.filter((it) => it.diffQty !== null && it.diffQty > 0);
  const totalDiffAmount = inventory.items.reduce((sum, it) => sum + (it.diffAmount ?? 0), 0);

  const handleFinish = () => {
    if (shortageItems.length > 0) {
      setCompleting(true);
      return;
    }
    completeMut.mutate({});
  };

  const readOnlyColumns: Column<InventoryItemDto>[] = [
    { key: 'product', header: 'Продукт', primary: true, render: (it) => it.productName },
    { key: 'system', header: 'По системе', align: 'right', render: (it) => qty(it.systemQty, it.unit) },
    {
      key: 'fact',
      header: 'Факт',
      align: 'right',
      render: (it) => (it.factQty === null ? '—' : qty(it.factQty, it.unit)),
    },
    {
      key: 'diff',
      header: 'Разница',
      align: 'right',
      render: (it) => (
        <span className={diffToneClass(it.diffQty)}>
          {it.diffQty === null ? '—' : `${it.diffQty > 0 ? '+' : ''}${qty(it.diffQty, it.unit)}`}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Сумма',
      align: 'right',
      render: (it) => (it.diffAmount === null ? '—' : <span className={diffToneClass(it.diffAmount)}>{money(it.diffAmount)}</span>),
    },
    ...(inventory.status === InventoryStatus.COMPLETED
      ? [
          {
            key: 'explanation',
            header: 'Объяснение / ответственный',
            hideOnMobile: false,
            render: (it: InventoryItemDto) =>
              it.explanation ? `${it.explanation} (${it.responsibleName ?? '—'})` : '—',
          },
        ]
      : []),
  ];

  return (
    <Modal open onClose={onClose} title={`Инвентаризация №${inventory.number}`} size="lg">
      <p className={styles.mutedNote}>
        {inventory.warehouseName} · {InventoryScopeLabel[inventory.scope]} · начал {inventory.startedByName},{' '}
        {formatDateTime(inventory.startedAt)}
      </p>
      {inventory.note && <p className={styles.mutedNote}>Комментарий: {inventory.note}</p>}

      <div className={styles.summary}>
        <span>Позиций: {inventory.items.length}</span>
        {shortageItems.length > 0 && <span className={styles.diffNegative}>Недостача: {shortageItems.length} поз.</span>}
        {surplusItems.length > 0 && <span className={styles.diffPositive}>Излишек: {surplusItems.length} поз.</span>}
        <span>Сумма расхождений: {money(totalDiffAmount)}</span>
      </div>

      {editable ? (
        <>
          <h3 className={styles.sectionTitle}>Пересчёт</h3>
          <CountForm items={inventory.items} onSubmit={(counts) => countMut.mutate({ counts })} saving={countMut.isPending} />
        </>
      ) : (
        <DataTable columns={readOnlyColumns} rows={inventory.items} rowKey={(it) => it.id} emptyText="Нет позиций" />
      )}

      {completing && (
        <ShortageForm
          items={shortageItems}
          users={users}
          saving={completeMut.isPending}
          onCancel={() => setCompleting(false)}
          onSubmit={(shortages) => completeMut.mutate({ shortages })}
        />
      )}

      {isInProgress && canManage && !completing && (
        <div className={styles.actionsRow}>
          {uncountedItems.length > 0 && (
            <span className={styles.mutedNote}>Сохраните факт по всем позициям, чтобы завершить ({uncountedItems.length} без факта)</span>
          )}
          <Button variant="danger" onClick={() => cancelMut.mutate()} loading={cancelMut.isPending}>
            Отменить
          </Button>
          <Button onClick={handleFinish} loading={completeMut.isPending} disabled={uncountedItems.length > 0}>
            Завершить
          </Button>
        </div>
      )}
    </Modal>
  );
}

function CountForm({
  items,
  onSubmit,
  saving,
}: {
  items: InventoryItemDto[];
  onSubmit: (counts: SubmitCountsInput['counts']) => void;
  saving: boolean;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<SubmitCountsInput>({
    resolver: zodResolver(submitCountsSchema),
    defaultValues: {
      counts: items.map((it) => ({ itemId: it.id, factQty: it.factQty ?? it.systemQty })),
    },
  });

  const watchedCounts = useWatch({ control, name: 'counts' });

  return (
    <div className={styles.countBlock}>
      {items.map((it, idx) => {
        const factRaw = watchedCounts?.[idx]?.factQty;
        const fact = typeof factRaw === 'number' && !Number.isNaN(factRaw) ? factRaw : null;
        const diff = fact === null ? null : fact - it.systemQty;
        return (
          <div key={it.id} className={styles.countRow}>
            <span className={styles.countProduct}>{it.productName}</span>
            <input type="hidden" {...register(`counts.${idx}.itemId` as const)} />
            <div className={styles.countPair}>
              <span className={styles.countPairLabel}>По системе</span>
              <span>{qty(it.systemQty, it.unit)}</span>
            </div>
            <div className={styles.countPair}>
              <span className={styles.countPairLabel}>Факт</span>
              <Input
                type="number"
                step="0.001"
                className={styles.countInput}
                {...register(`counts.${idx}.factQty` as const, { valueAsNumber: true })}
              />
            </div>
            <div className={styles.countPair}>
              <span className={styles.countPairLabel}>Разница</span>
              <span className={diffToneClass(diff)}>
                {diff === null ? '—' : `${diff > 0 ? '+' : ''}${qty(diff, it.unit)}`}
              </span>
            </div>
            <div className={styles.countPair}>
              <span className={styles.countPairLabel}>Сумма</span>
              <span className={diffToneClass(it.diffAmount)}>{it.diffAmount === null ? '—' : money(it.diffAmount)}</span>
            </div>
          </div>
        );
      })}
      {errors.counts && <p className={styles.error}>Проверьте введённые значения факта</p>}
      <div className={styles.countActions}>
        <Button onClick={handleSubmit((data) => onSubmit(data.counts))} loading={saving}>
          Сохранить факт
        </Button>
      </div>
    </div>
  );
}

function ShortageForm({
  items,
  users,
  saving,
  onCancel,
  onSubmit,
}: {
  items: InventoryItemDto[];
  users: UserDto[];
  saving: boolean;
  onCancel: () => void;
  onSubmit: (shortages: NonNullable<CompleteInventoryInput['shortages']>) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CompleteInventoryInput>({
    resolver: zodResolver(completeInventorySchema),
    defaultValues: {
      shortages: items.map((it) => ({
        itemId: it.id,
        explanation: it.explanation ?? '',
        responsibleId: it.responsibleId ?? '',
      })),
    },
  });

  const submit = (data: CompleteInventoryInput) => onSubmit(data.shortages ?? []);

  return (
    <div className={styles.shortageBlock}>
      <p className={styles.shortageTitle}>Обнаружена недостача — укажите причину и ответственного по каждой позиции</p>
      {items.map((it, idx) => (
        <ShortageRow key={it.id} item={it} idx={idx} users={users} register={register} errors={errors} />
      ))}
      <div className={styles.shortageActions}>
        <Button variant="secondary" onClick={onCancel}>
          Назад
        </Button>
        <Button onClick={handleSubmit(submit)} loading={saving}>
          Подтвердить завершение
        </Button>
      </div>
    </div>
  );
}

function ShortageRow({
  item,
  idx,
  users,
  register,
  errors,
}: {
  item: InventoryItemDto;
  idx: number;
  users: UserDto[];
  register: UseFormRegister<CompleteInventoryInput>;
  errors: FieldErrors<CompleteInventoryInput>;
}) {
  return (
    <div className={styles.shortageItem}>
      <div className={styles.shortageItemHead}>
        <span>{item.productName}</span>
        <span className={styles.diffNegative}>{item.diffQty !== null ? qty(item.diffQty, item.unit) : '—'}</span>
      </div>
      <input type="hidden" {...register(`shortages.${idx}.itemId` as const)} />
      <Field label="Причина недостачи" error={errors.shortages?.[idx]?.explanation?.message} required>
        <Textarea rows={2} {...register(`shortages.${idx}.explanation` as const)} />
      </Field>
      <Field label="Ответственный" error={errors.shortages?.[idx]?.responsibleId?.message} required>
        <Select
          placeholder="Выберите сотрудника"
          options={users.map((u) => ({ value: u.id, label: u.fullName }))}
          {...register(`shortages.${idx}.responsibleId` as const)}
        />
      </Field>
    </div>
  );
}
