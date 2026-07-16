import { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodForm as zodResolver } from '../../shared';
import {
  ProductKind,
  ProductKindLabel,
  StockMovementType,
  StockMovementTypeLabel,
  Unit,
  UnitLabel,
  WarehouseType,
  type StockItemDto,
  type StockMovementDto,
} from '@sheben/shared';
import {
  warehouseKeys,
  fetchWarehouses,
  fetchStock,
  fetchMovements,
  adjustStock,
  adjustStockSchema,
  type AdjustStockInput,
} from '../../entities/warehouse/api';
import { productKeys, fetchProducts } from '../../entities/product/api';
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
  StatusChip,
  LoadMore,
  num,
  qty,
  formatDateTime,
  useOptimisticMutation,
  type Column,
} from '../../shared';
import { useAuth } from '../../shared/auth/useAuth';
import styles from './WarehousePage.module.css';

const MOVEMENTS_PAGE_SIZE = 50;

const warehouseTypeLabel: Record<WarehouseType, string> = {
  RAW: 'Сырьевой склад (горная масса)',
  FINISHED: 'Склад готовой продукции',
};

function unitLabel(unit: string): string {
  return unit === Unit.TON ? UnitLabel.TON : UnitLabel.M3;
}

function productKindLabel(kind: string): string {
  return kind === ProductKind.RAW ? ProductKindLabel.RAW : ProductKindLabel.FINISHED;
}

function SignedQty({ value, unit }: { value: number; unit: string }) {
  const positive = value >= 0;
  return (
    <span className={positive ? styles.qtyIn : styles.qtyOut}>
      {positive ? '+' : '−'}
      {num(Math.abs(value))} {unit}
    </span>
  );
}

export function WarehousePage() {
  const { hasRole } = useAuth();
  const canAdjust = hasRole('OWNER', 'ADMIN');
  const qc = useQueryClient();

  const [tab, setTab] = useState<'stock' | 'movements'>('stock');
  const [adjustOpen, setAdjustOpen] = useState(false);

  const [stockWarehouseId, setStockWarehouseId] = useState('');
  const [belowMinOnly, setBelowMinOnly] = useState(false);

  const [movWarehouseId, setMovWarehouseId] = useState('');
  const [movProductId, setMovProductId] = useState('');
  const [movType, setMovType] = useState('');

  const { data: warehouses = [] } = useQuery({ queryKey: warehouseKeys.list, queryFn: fetchWarehouses });
  const allProductsParams = useMemo(() => ({}), []);
  const { data: products = [] } = useQuery({
    queryKey: productKeys.list(allProductsParams),
    queryFn: () => fetchProducts(allProductsParams),
  });

  const stockParams = useMemo(
    () => ({ warehouseId: stockWarehouseId || undefined, belowMin: belowMinOnly || undefined }),
    [stockWarehouseId, belowMinOnly],
  );
  const stockKey = warehouseKeys.stock(stockParams);
  const { data: stockItems = [], isLoading: stockLoading } = useQuery({
    queryKey: stockKey,
    queryFn: () => fetchStock(stockParams),
    enabled: tab === 'stock',
  });

  const movementsFilter = useMemo(
    () => ({
      warehouseId: movWarehouseId || undefined,
      productId: movProductId || undefined,
      type: (movType || undefined) as StockMovementType | undefined,
    }),
    [movWarehouseId, movProductId, movType],
  );
  const movementsKey = warehouseKeys.movements(movementsFilter);

  const {
    data: movementsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: movementsLoading,
  } = useInfiniteQuery({
    queryKey: movementsKey,
    queryFn: ({ pageParam }) => fetchMovements({ ...movementsFilter, cursor: pageParam, limit: MOVEMENTS_PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: tab === 'movements',
  });

  const movements = movementsData?.pages.flatMap((p) => p.items) ?? [];

  const adjustMut = useOptimisticMutation<StockItemDto, AdjustStockInput, StockItemDto[]>({
    mutationFn: adjustStock,
    queryKeys: [stockKey],
    updater: (old, vars) => {
      const list = old ?? [];
      const product = products.find((p) => p.id === vars.productId);
      const warehouse = warehouses.find((w) => w.type === vars.warehouseType);
      if (!product || !warehouse) return list;

      const idx = list.findIndex((item) => item.productId === vars.productId && item.warehouseId === warehouse.id);
      if (idx === -1) {
        return [
          ...list,
          {
            warehouseId: warehouse.id,
            warehouseName: warehouse.name,
            productId: product.id,
            productName: product.name,
            productKind: product.kind,
            unit: product.unit,
            quantity: vars.targetQty,
            minStock: product.minStock,
            belowMin: product.minStock !== null && vars.targetQty < product.minStock,
          },
        ];
      }

      const item = list[idx];
      if (!item) return list;
      const updated: StockItemDto = {
        ...item,
        quantity: vars.targetQty,
        belowMin: item.minStock !== null && vars.targetQty < item.minStock,
      };
      return list.map((it, i) => (i === idx ? updated : it));
    },
    successMessage: 'Остаток скорректирован',
    onDone: () => {
      setAdjustOpen(false);
      // Корректировка создаёт движение (MANUAL_ADJUST) — обновляем и остатки, и журнал движений.
      void qc.invalidateQueries({ queryKey: warehouseKeys.all });
    },
  });

  const warehouseOptions = [{ value: '', label: 'Все склады' }, ...warehouses.map((w) => ({ value: w.id, label: w.name }))];
  const productOptions = [{ value: '', label: 'Все продукты' }, ...products.map((p) => ({ value: p.id, label: p.name }))];
  const typeOptions = [
    { value: '', label: 'Все типы' },
    ...Object.values(StockMovementType).map((t) => ({ value: t, label: StockMovementTypeLabel[t] })),
  ];

  const stockColumns: Column<StockItemDto>[] = [
    { key: 'warehouseName', header: 'Склад', primary: true, render: (s) => s.warehouseName },
    { key: 'productName', header: 'Продукт', render: (s) => s.productName },
    { key: 'productKind', header: 'Тип', render: (s) => productKindLabel(s.productKind) },
    { key: 'quantity', header: 'Количество', align: 'right', render: (s) => qty(s.quantity, unitLabel(s.unit)) },
    {
      key: 'minStock',
      header: 'Мин. остаток',
      align: 'right',
      render: (s) => (s.minStock !== null ? qty(s.minStock, unitLabel(s.unit)) : '—'),
    },
    {
      key: 'belowMin',
      header: '',
      render: (s) => (s.belowMin ? <StatusChip value="REJECTED" label="ниже минимума" /> : null),
    },
  ];

  const movementColumns: Column<StockMovementDto>[] = [
    { key: 'createdAt', header: 'Дата/время', primary: true, render: (m) => formatDateTime(m.createdAt) },
    { key: 'warehouseName', header: 'Склад', render: (m) => m.warehouseName },
    { key: 'productName', header: 'Продукт', render: (m) => m.productName },
    { key: 'type', header: 'Тип движения', render: (m) => StockMovementTypeLabel[m.type] },
    { key: 'qty', header: 'Количество', align: 'right', render: (m) => <SignedQty value={m.qty} unit={unitLabel(m.unit)} /> },
    { key: 'byUserName', header: 'Кто', render: (m) => m.byUserName },
    { key: 'comment', header: 'Комментарий', render: (m) => m.comment ?? '—' },
  ];

  return (
    <div>
      <PageHeader
        title="Склад"
        subtitle="Остатки и движения товаров"
        actions={canAdjust && <Button onClick={() => setAdjustOpen(true)}>Корректировка</Button>}
      />

      <div className={styles.tabs}>
        <Button size="sm" variant={tab === 'stock' ? 'primary' : 'secondary'} onClick={() => setTab('stock')}>
          Остатки
        </Button>
        <Button size="sm" variant={tab === 'movements' ? 'primary' : 'secondary'} onClick={() => setTab('movements')}>
          Движения
        </Button>
      </div>

      {tab === 'stock' && (
        <Card padded={false}>
          <div className={styles.filters}>
            <Select options={warehouseOptions} value={stockWarehouseId} onChange={(e) => setStockWarehouseId(e.target.value)} />
            <label className={styles.checkboxRow}>
              <input type="checkbox" checked={belowMinOnly} onChange={(e) => setBelowMinOnly(e.target.checked)} />
              Только ниже минимума
            </label>
          </div>
          <div style={{ padding: 12 }}>
            <DataTable
              columns={stockColumns}
              rows={stockItems}
              rowKey={(s) => `${s.warehouseId}-${s.productId}`}
              loading={stockLoading}
              emptyText="Нет остатков"
            />
          </div>
        </Card>
      )}

      {tab === 'movements' && (
        <Card padded={false}>
          <div className={styles.filters}>
            <Select options={warehouseOptions} value={movWarehouseId} onChange={(e) => setMovWarehouseId(e.target.value)} />
            <Select options={productOptions} value={movProductId} onChange={(e) => setMovProductId(e.target.value)} />
            <Select options={typeOptions} value={movType} onChange={(e) => setMovType(e.target.value)} />
          </div>
          <div style={{ padding: 12 }}>
            <DataTable
              columns={movementColumns}
              rows={movements}
              rowKey={(m) => m.id}
              loading={movementsLoading}
              emptyText="Нет движений"
              footer={
                <LoadMore hasMore={Boolean(hasNextPage)} loading={isFetchingNextPage} onLoad={() => void fetchNextPage()} />
              }
            />
          </div>
        </Card>
      )}

      {adjustOpen && (
        <AdjustStockModal
          products={products.map((p) => ({ id: p.id, name: p.name, kind: p.kind }))}
          onClose={() => setAdjustOpen(false)}
          onSubmit={(input) => adjustMut.mutate(input)}
          saving={adjustMut.isPending}
        />
      )}
    </div>
  );
}

function AdjustStockModal({
  products,
  onClose,
  onSubmit,
  saving,
}: {
  products: { id: string; name: string; kind: string }[];
  onClose: () => void;
  onSubmit: (input: AdjustStockInput) => void;
  saving: boolean;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AdjustStockInput>({
    resolver: zodResolver(adjustStockSchema),
    defaultValues: { warehouseType: WarehouseType.RAW, productId: '', targetQty: 0, comment: '' },
  });

  const warehouseType = watch('warehouseType');
  const availableProducts = products.filter((p) => p.kind === warehouseType);

  useEffect(() => {
    setValue('productId', '');
  }, [warehouseType, setValue]);

  return (
    <Modal
      open
      onClose={onClose}
      title="Корректировка остатка"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button onClick={handleSubmit(onSubmit)} loading={saving}>Сохранить</Button>
        </>
      }
    >
      <Field label="Склад" error={errors.warehouseType?.message} required>
        <Select
          options={Object.values(WarehouseType).map((t) => ({ value: t, label: warehouseTypeLabel[t] }))}
          {...register('warehouseType')}
        />
      </Field>
      <Field label="Продукт" error={errors.productId?.message} required>
        <Select
          placeholder="Выберите продукт"
          options={availableProducts.map((p) => ({ value: p.id, label: p.name }))}
          {...register('productId')}
        />
      </Field>
      <Field label="Целевой остаток" error={errors.targetQty?.message} required>
        <Input type="number" step="0.001" {...register('targetQty', { valueAsNumber: true })} />
      </Field>
      <Field label="Комментарий" error={errors.comment?.message} required>
        <Textarea rows={3} placeholder="Причина корректировки" {...register('comment')} />
      </Field>
    </Modal>
  );
}
