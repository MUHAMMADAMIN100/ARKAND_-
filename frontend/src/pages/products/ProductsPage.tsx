import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodForm as zodResolver } from '../../shared';
import {
  createProductSchema,
  ProductKind,
  ProductKindLabel,
  Unit,
  UnitLabel,
  type CreateProductInput,
  type ProductDto,
} from '@sheben/shared';
import { productKeys, fetchProducts, createProduct, updateProduct, deleteProduct } from '../../entities/product/api';
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
  money,
  num,
  optionalNumber,
  useOptimisticMutation,
  type Column,
} from '../../shared';
import { useAuth } from '../../shared/auth/useAuth';

export function ProductsPage() {
  const { hasRole } = useAuth();
  const canEdit = hasRole('OWNER', 'ADMIN', 'OPERATOR');
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProductDto | null>(null);

  const { data: products = [], isLoading } = useQuery({
    queryKey: productKeys.list({ all: true }),
    queryFn: () => fetchProducts({ all: true }),
  });

  const listKey = productKeys.list({ all: true });

  const createMut = useOptimisticMutation<ProductDto, CreateProductInput, ProductDto[]>({
    mutationFn: createProduct,
    queryKeys: [listKey],
    updater: (old, vars) => [
      ...(old ?? []),
      {
        id: `tmp-${Date.now()}`,
        name: vars.name,
        kind: vars.kind,
        unit: vars.unit ?? Unit.M3,
        price: vars.price,
        minStock: vars.minStock ?? null,
        isActive: true,
        sortOrder: vars.sortOrder ?? 0,
        stock: 0,
      },
    ],
    successMessage: 'Продукция добавлена',
    onDone: () => closeModal(),
  });

  const updateMut = useOptimisticMutation<ProductDto, { id: string; input: CreateProductInput }, ProductDto[]>({
    mutationFn: ({ id, input }) => updateProduct(id, input),
    queryKeys: [listKey],
    updater: (old, vars) =>
      (old ?? []).map((p) => (p.id === vars.id ? { ...p, ...vars.input } : p)),
    successMessage: 'Сохранено',
    onDone: () => closeModal(),
  });

  const deleteMut = useOptimisticMutation<void, string, ProductDto[]>({
    mutationFn: deleteProduct,
    queryKeys: [listKey],
    updater: (old, id) => (old ?? []).map((p) => (p.id === id ? { ...p, isActive: false } : p)),
    successMessage: 'Позиция деактивирована',
  });

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    void qc.invalidateQueries({ queryKey: productKeys.all });
  }

  const columns: Column<ProductDto>[] = [
    {
      key: 'name',
      header: 'Название',
      primary: true,
      render: (p) => (
        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          {p.name}
          {!p.isActive && <StatusChip value="CANCELLED" label="неактивна" />}
        </span>
      ),
    },
    { key: 'kind', header: 'Тип', render: (p) => ProductKindLabel[p.kind] },
    { key: 'price', header: 'Цена', align: 'right', render: (p) => money(p.price) },
    { key: 'stock', header: 'Остаток', align: 'right', render: (p) => `${num(p.stock)} ${UnitLabel[p.unit]}` },
    ...(canEdit
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right' as const,
            render: (p: ProductDto) => (
              <span style={{ display: 'inline-flex', gap: 6 }}>
                <Button size="sm" variant="secondary" onClick={() => { setEditing(p); setModalOpen(true); }}>
                  ✎
                </Button>
                {p.isActive && (
                  <Button size="sm" variant="ghost" onClick={() => deleteMut.mutate(p.id)}>
                    🗑
                  </Button>
                )}
              </span>
            ),
          },
        ]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title="Продукция"
        subtitle="Фракции и цены"
        actions={canEdit && <Button onClick={() => { setEditing(null); setModalOpen(true); }}>+ Добавить</Button>}
      />
      <Card padded={false}>
        <div style={{ padding: 12 }}>
          <DataTable columns={columns} rows={products} rowKey={(p) => p.id} loading={isLoading} emptyText="Нет продукции" />
        </div>
      </Card>

      {modalOpen && (
        <ProductModal
          product={editing}
          onClose={closeModal}
          onCreate={(input) => createMut.mutate(input)}
          onUpdate={(id, input) => updateMut.mutate({ id, input })}
          saving={createMut.isPending || updateMut.isPending}
        />
      )}
    </div>
  );
}

function ProductModal({
  product,
  onClose,
  onCreate,
  onUpdate,
  saving,
}: {
  product: ProductDto | null;
  onClose: () => void;
  onCreate: (input: CreateProductInput) => void;
  onUpdate: (id: string, input: CreateProductInput) => void;
  saving: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateProductInput>({
    resolver: zodResolver(createProductSchema),
    defaultValues: product
      ? { name: product.name, kind: product.kind, unit: product.unit, price: product.price, minStock: product.minStock ?? undefined, sortOrder: product.sortOrder }
      : { kind: ProductKind.FINISHED, unit: Unit.M3, sortOrder: 0 },
  });

  const submit = (data: CreateProductInput) => {
    if (product) onUpdate(product.id, data);
    else onCreate(data);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={product ? 'Редактировать продукцию' : 'Новая продукция'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button onClick={handleSubmit(submit)} loading={saving}>Сохранить</Button>
        </>
      }
    >
      <Field label="Название" error={errors.name?.message} required>
        <Input placeholder="Щебень 5-20" {...register('name')} />
      </Field>
      <Field label="Тип" error={errors.kind?.message} required>
        <Select
          options={Object.values(ProductKind).map((k) => ({ value: k, label: ProductKindLabel[k] }))}
          {...register('kind')}
        />
      </Field>
      <Field label="Единица" error={errors.unit?.message}>
        <Select options={Object.values(Unit).map((u) => ({ value: u, label: UnitLabel[u] }))} {...register('unit')} />
      </Field>
      <Field label="Цена за единицу" error={errors.price?.message} required>
        <Input type="number" step="0.01" {...register('price', { valueAsNumber: true })} />
      </Field>
      <Field label="Мин. остаток (автозаявка)" error={errors.minStock?.message}>
        <Input type="number" step="0.001" {...register('minStock', optionalNumber)} />
      </Field>
    </Modal>
  );
}
