import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodForm as zodResolver } from '../../shared';
import {
  openShiftSchema,
  recordOutputSchema,
  ProductKind,
  ShiftStatus,
  ShiftStatusLabel,
  Unit,
  UnitLabel,
  type CloseShiftInput,
  type OpenShiftInput,
  type Paginated,
  type ProductDto,
  type ProductionShiftDto,
  type RecordOutputInput,
  type ShiftOutputDto,
} from '@sheben/shared';
import {
  productionKeys,
  fetchShifts,
  fetchShift,
  openShift,
  recordOutput,
  closeShift,
  type ShiftListParams,
} from '../../entities/production/api';
import { productKeys, fetchProducts } from '../../entities/product/api';
import { warehouseKeys } from '../../entities/warehouse/api';
import {
  Button,
  Card,
  DataTable,
  Field,
  Input,
  Select,
  Textarea,
  Modal,
  PageHeader,
  Pagination,
  StatusChip,
  qty,
  formatDate,
  todayISO,
  useOptimisticMutation,
  type Column,
} from '../../shared';
import { useAuth } from '../../shared/auth/useAuth';
import styles from './ProductionPage.module.css';

const PAGE_SIZE = 20;

function unitLabel(unit: string): string {
  return unit === Unit.TON ? UnitLabel.TON : UnitLabel.M3;
}

export function ProductionPage() {
  const { hasRole, user } = useAuth();
  const canManage = hasRole('OPERATOR', 'ASSISTANT_OPERATOR');
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [openModalOpen, setOpenModalOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<ProductionShiftDto | null>(null);

  const listParams: ShiftListParams = useMemo(() => ({ page, pageSize: PAGE_SIZE }), [page]);
  const listKey = productionKeys.list(listParams);

  const { data, isLoading } = useQuery({
    queryKey: listKey,
    queryFn: () => fetchShifts(listParams),
  });

  const shifts = data?.items ?? [];

  const openMut = useOptimisticMutation<ProductionShiftDto, OpenShiftInput, Paginated<ProductionShiftDto>>({
    mutationFn: openShift,
    queryKeys: [listKey],
    updater: (old, vars) => {
      if (!old) return old;
      const tempShift: ProductionShiftDto = {
        id: `tmp-${Date.now()}`,
        date: vars.date,
        shiftNumber: vars.shiftNumber,
        status: ShiftStatus.OPEN,
        operatorId: user?.id ?? '',
        operatorName: user?.fullName ?? '—',
        rawConsumed: 0,
        totalOutput: 0,
        outputs: [],
        note: vars.note ?? null,
        closedAt: null,
        createdAt: new Date().toISOString(),
      };
      return { ...old, items: [tempShift, ...old.items], total: old.total + 1 };
    },
    successMessage: 'Смена открыта',
    onDone: () => setOpenModalOpen(false),
  });

  function closeShiftDetail() {
    setSelectedShift(null);
    void qc.invalidateQueries({ queryKey: productionKeys.all });
  }

  const columns: Column<ProductionShiftDto>[] = [
    { key: 'date', header: 'Дата', primary: true, render: (s) => formatDate(s.date) },
    { key: 'shiftNumber', header: '№ смены', render: (s) => String(s.shiftNumber) },
    { key: 'operatorName', header: 'Оператор', render: (s) => s.operatorName },
    { key: 'status', header: 'Статус', render: (s) => <StatusChip value={s.status} label={ShiftStatusLabel[s.status]} /> },
    { key: 'totalOutput', header: 'Выпуск', align: 'right', render: (s) => qty(s.totalOutput) },
    { key: 'rawConsumed', header: 'Расход породы', align: 'right', render: (s) => qty(s.rawConsumed) },
  ];

  return (
    <div>
      <PageHeader
        title="Производство"
        subtitle="Смены и выпуск по фракциям"
        actions={canManage && <Button onClick={() => setOpenModalOpen(true)}>+ Открыть смену</Button>}
      />

      <Card padded={false}>
        <div style={{ padding: 12 }}>
          <DataTable
            columns={columns}
            rows={shifts}
            rowKey={(s) => s.id}
            loading={isLoading}
            emptyText="Нет смен"
            onRowClick={setSelectedShift}
            footer={data && <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />}
          />
        </div>
      </Card>

      {openModalOpen && (
        <OpenShiftModal
          onClose={() => setOpenModalOpen(false)}
          onSubmit={(input) => openMut.mutate(input)}
          saving={openMut.isPending}
        />
      )}

      {selectedShift && (
        <ShiftDetailModal shift={selectedShift} canManage={canManage} onClose={closeShiftDetail} />
      )}
    </div>
  );
}

function OpenShiftModal({
  onClose,
  onSubmit,
  saving,
}: {
  onClose: () => void;
  onSubmit: (input: OpenShiftInput) => void;
  saving: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OpenShiftInput>({
    resolver: zodResolver(openShiftSchema),
    defaultValues: { date: todayISO(), shiftNumber: 1 },
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Открыть смену"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button onClick={handleSubmit(onSubmit)} loading={saving}>Открыть</Button>
        </>
      }
    >
      <Field label="Дата" error={errors.date?.message} required>
        <Input type="date" {...register('date')} />
      </Field>
      <Field label="№ смены" error={errors.shiftNumber?.message} required>
        <Select
          options={[1, 2, 3].map((n) => ({ value: String(n), label: `Смена ${n}` }))}
          {...register('shiftNumber', { valueAsNumber: true })}
        />
      </Field>
      <Field label="Примечание" error={errors.note?.message}>
        <Textarea rows={3} placeholder="Необязательно" {...register('note')} />
      </Field>
    </Modal>
  );
}

function ShiftDetailModal({
  shift,
  canManage,
  onClose,
}: {
  shift: ProductionShiftDto;
  canManage: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const detailKey = productionKeys.detail(shift.id);
  const [outputFormOpen, setOutputFormOpen] = useState(false);

  const { data } = useQuery({
    queryKey: detailKey,
    queryFn: () => fetchShift(shift.id),
    initialData: shift,
  });

  const current = data ?? shift;
  const isOpen = current.status === ShiftStatus.OPEN;

  const finishedProductsParams = useMemo(() => ({ kind: ProductKind.FINISHED }), []);
  const { data: finishedProducts = [] } = useQuery({
    queryKey: productKeys.list(finishedProductsParams),
    queryFn: () => fetchProducts(finishedProductsParams),
  });

  const outputMut = useOptimisticMutation<ProductionShiftDto, RecordOutputInput, ProductionShiftDto>({
    mutationFn: (input) => recordOutput(current.id, input),
    queryKeys: [detailKey],
    updater: (old, vars) => {
      const base = old ?? current;
      const byProduct = new Map(base.outputs.map((o) => [o.productId, o]));
      for (const entry of vars.outputs) {
        const product = finishedProducts.find((p) => p.id === entry.productId);
        const existing = byProduct.get(entry.productId);
        byProduct.set(entry.productId, {
          id: existing?.id ?? `tmp-${entry.productId}`,
          productId: entry.productId,
          productName: product?.name ?? existing?.productName ?? '—',
          unit: product?.unit ?? existing?.unit ?? Unit.M3,
          quantity: entry.quantity,
        });
      }
      const outputs = Array.from(byProduct.values());
      const totalOutput = outputs.reduce((sum, o) => sum + o.quantity, 0);
      return {
        ...base,
        outputs,
        totalOutput,
        rawConsumed: base.rawConsumed + (vars.rawConsumed ?? 0),
      };
    },
    successMessage: 'Выпуск внесён',
    onDone: () => {
      setOutputFormOpen(false);
      void qc.invalidateQueries({ queryKey: productionKeys.all });
      // Выпуск приходует продукцию и списывает горную массу — обновляем склад и остатки в каталоге.
      void qc.invalidateQueries({ queryKey: warehouseKeys.all });
      void qc.invalidateQueries({ queryKey: productKeys.all });
    },
  });

  const closeMut = useOptimisticMutation<ProductionShiftDto, CloseShiftInput, ProductionShiftDto>({
    mutationFn: (input) => closeShift(current.id, input),
    queryKeys: [detailKey],
    updater: (old) => {
      const base = old ?? current;
      return { ...base, status: ShiftStatus.CLOSED, closedAt: new Date().toISOString() };
    },
    successMessage: 'Смена закрыта',
    onDone: () => void qc.invalidateQueries({ queryKey: productionKeys.all }),
  });

  return (
    <Modal open onClose={onClose} title={`Смена №${current.shiftNumber} от ${formatDate(current.date)}`} size="lg">
      <div className={styles.summaryRow}>
        <StatusChip value={current.status} label={ShiftStatusLabel[current.status]} />
        <span>{current.operatorName}</span>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Общий выпуск</span>
          <span className={styles.statValue}>{qty(current.totalOutput)}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Израсходовано породы</span>
          <span className={styles.statValue}>{qty(current.rawConsumed)}</span>
        </div>
      </div>

      <h3 className={styles.sectionTitle}>Выпуск по фракциям</h3>
      {current.outputs.length === 0 ? (
        <p className={styles.dim}>Выпуск ещё не внесён</p>
      ) : (
        <div className={styles.outputsGrid}>
          {current.outputs.map((o) => (
            <div key={o.productId} className={styles.outputItem}>
              <span className={styles.outputName}>{o.productName}</span>
              <span className={styles.outputQty}>{qty(o.quantity, unitLabel(o.unit))}</span>
            </div>
          ))}
        </div>
      )}

      {canManage && isOpen && !outputFormOpen && (
        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => setOutputFormOpen(true)}>Внести выпуск</Button>
          <Button variant="danger" onClick={() => closeMut.mutate({})} loading={closeMut.isPending}>
            Закрыть смену
          </Button>
        </div>
      )}

      {canManage && isOpen && outputFormOpen && (
        <RecordOutputForm
          products={finishedProducts}
          initialOutputs={current.outputs}
          onCancel={() => setOutputFormOpen(false)}
          onSubmit={(input) => outputMut.mutate(input)}
          saving={outputMut.isPending}
        />
      )}
    </Modal>
  );
}

function RecordOutputForm({
  products,
  initialOutputs,
  onCancel,
  onSubmit,
  saving,
}: {
  products: ProductDto[];
  initialOutputs: ShiftOutputDto[];
  onCancel: () => void;
  onSubmit: (input: RecordOutputInput) => void;
  saving: boolean;
}) {
  // Показываем уже внесённые за смену значения — бэк трактует ввод как ИТОГ за смену (перезапись),
  // так что оператор видит текущее и не вводит «добавку» повторно.
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RecordOutputInput>({
    resolver: zodResolver(recordOutputSchema),
    defaultValues: {
      outputs:
        initialOutputs.length > 0
          ? initialOutputs.map((o) => ({ productId: o.productId, quantity: o.quantity }))
          : [{ productId: '', quantity: 0 }],
      rawConsumed: undefined,
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'outputs' });

  return (
    <form className={styles.outputForm} onSubmit={handleSubmit(onSubmit)}>
      {fields.map((field, index) => (
        <div key={field.id} className={styles.outputRow}>
          <Field label="Фракция" error={errors.outputs?.[index]?.productId?.message} required>
            <Select
              placeholder="Выберите фракцию"
              options={products.map((p) => ({ value: p.id, label: p.name }))}
              {...register(`outputs.${index}.productId`)}
            />
          </Field>
          <Field label="Количество" error={errors.outputs?.[index]?.quantity?.message} required>
            <Input type="number" step="0.001" {...register(`outputs.${index}.quantity`, { valueAsNumber: true })} />
          </Field>
          {fields.length > 1 && (
            <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
              Убрать
            </Button>
          )}
        </div>
      ))}

      <Button type="button" variant="secondary" size="sm" onClick={() => append({ productId: '', quantity: 0 })}>
        + Добавить фракцию
      </Button>

      <Field label="Израсходовано горной массы" error={errors.rawConsumed?.message}>
        <Input
          type="number"
          step="0.001"
          {...register('rawConsumed', {
            setValueAs: (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
          })}
        />
      </Field>

      <div className={styles.actions}>
        <Button type="button" variant="secondary" onClick={onCancel}>Отмена</Button>
        <Button type="submit" loading={saving}>Сохранить выпуск</Button>
      </div>
    </form>
  );
}
