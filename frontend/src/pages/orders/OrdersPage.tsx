import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFieldArray, useForm } from 'react-hook-form';
import { FiTrash2 } from 'react-icons/fi';
import { zodForm as zodResolver } from '../../shared';
import {
  createOrderSchema,
  DeliveryType,
  DeliveryTypeLabel,
  OrderStatus,
  OrderStatusLabel,
  PaymentMethod,
  PaymentMethodLabel,
  type CreateOrderInput,
  type OrderDto,
  type ProductDto,
} from '@sheben/shared';
import {
  orderKeys,
  fetchOrders,
  createOrder,
  changeOrderStatus,
  deleteOrder,
  fetchClients,
} from '../../entities/order/api';
import { fetchProducts, productKeys } from '../../entities/product/api';
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
  num,
  formatDate,
  useDebounce,
  useOptimisticMutation,
  toast,
  type Column,
} from '../../shared';
import { useAuth } from '../../shared/auth/useAuth';

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  NEW: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['READY', 'CANCELLED'],
  READY: ['SHIPPING', 'CANCELLED'],
  SHIPPING: ['COMPLETED', 'CANCELLED'],
};

export function OrdersPage() {
  const { hasRole } = useAuth();
  const canEdit = hasRole('OPERATOR', 'SALES_MANAGER', 'OWNER', 'ADMIN');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search);
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<OrderDto | null>(null);

  const filter = { page, pageSize: 25, status: (status || undefined) as OrderStatus | undefined, search: debounced || undefined };
  const listKey = orderKeys.list(filter);

  const { data, isLoading } = useQuery({ queryKey: listKey, queryFn: () => fetchOrders(filter) });

  const statusMut = useOptimisticMutation<OrderDto, { id: string; status: OrderStatus }>({
    mutationFn: ({ id, status }) => changeOrderStatus(id, status),
    queryKeys: [orderKeys.all],
    successMessage: 'Статус обновлён',
    onDone: (updated) => updated && setDetail(updated),
  });

  const deleteMut = useOptimisticMutation<void, string>({
    mutationFn: deleteOrder,
    queryKeys: [orderKeys.all],
    successMessage: 'Заказ удалён',
    onDone: () => setDetail(null),
  });

  const columns: Column<OrderDto>[] = [
    { key: 'number', header: '№', primary: true, render: (o) => `Заказ №${o.number}` },
    { key: 'client', header: 'Клиент', render: (o) => o.clientName },
    { key: 'status', header: 'Статус', render: (o) => <StatusChip value={o.status} label={OrderStatusLabel[o.status]} /> },
    { key: 'pay', header: 'Оплата', render: (o) => PaymentMethodLabel[o.paymentMethod], hideOnMobile: true },
    { key: 'sum', header: 'Сумма', align: 'right', render: (o) => money(o.totalAmount) },
    { key: 'date', header: 'Создан', align: 'right', render: (o) => formatDate(o.createdAt), hideOnMobile: true },
  ];

  return (
    <div>
      <PageHeader
        title="Заказы"
        subtitle="Продажи продукции карьера"
        actions={canEdit && <Button onClick={() => setCreateOpen(true)}>+ Новый заказ</Button>}
      />

      <Card padded>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <Select
            options={[{ value: '', label: 'Все статусы' }, ...Object.values(OrderStatus).map((s) => ({ value: s, label: OrderStatusLabel[s] }))]}
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            style={{ maxWidth: 200 }}
          />
          <Input placeholder="Поиск по клиенту / №" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ maxWidth: 260 }} />
        </div>
        <DataTable
          columns={columns}
          rows={data?.items ?? []}
          rowKey={(o) => o.id}
          loading={isLoading}
          emptyText="Заказов нет"
          onRowClick={(o) => setDetail(o)}
        />
        {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />}
      </Card>

      {createOpen && <OrderCreateModal onClose={() => setCreateOpen(false)} />}
      {detail && (
        <OrderDetailModal
          order={detail}
          canEdit={canEdit}
          onClose={() => setDetail(null)}
          onStatus={(s) => statusMut.mutate({ id: detail.id, status: s })}
          onDelete={() => deleteMut.mutate(detail.id)}
          busy={statusMut.isPending || deleteMut.isPending}
        />
      )}
    </div>
  );
}

function OrderCreateModal({ onClose }: { onClose: () => void }) {
  const { data: clients } = useQuery({ queryKey: ['clients', 'for-order'], queryFn: () => fetchClients({ pageSize: 100 }) });
  const { data: products } = useQuery({ queryKey: productKeys.list({ kind: 'FINISHED' }), queryFn: () => fetchProducts({ kind: 'FINISHED' }) });

  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<CreateOrderInput>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: { paymentMethod: PaymentMethod.CASH, deliveryType: DeliveryType.DELIVERY, items: [{ productId: '', quantity: 1 }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const items = watch('items');

  const productById = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products]);
  const total = (items ?? []).reduce((sum, it) => {
    const p = productById.get(it.productId);
    const price = it.price ?? p?.price ?? 0;
    return sum + price * (Number(it.quantity) || 0);
  }, 0);

  const createMut = useOptimisticMutation<OrderDto, CreateOrderInput>({
    mutationFn: createOrder,
    queryKeys: [orderKeys.all],
    successMessage: 'Заказ создан',
    onDone: () => onClose(),
  });

  const onPickProduct = (idx: number, productId: string) => {
    setValue(`items.${idx}.productId`, productId);
    const p = productById.get(productId);
    if (p) setValue(`items.${idx}.price`, p.price);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Новый заказ"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button loading={createMut.isPending} onClick={handleSubmit((d) => createMut.mutate(d))}>Создать</Button>
        </>
      }
    >
      <Field label="Клиент" error={errors.clientId?.message} required>
        <Select
          placeholder="Выберите клиента"
          options={(clients?.items ?? []).map((c) => ({ value: c.id, label: c.name }))}
          {...register('clientId')}
        />
      </Field>
      <div style={{ display: 'flex', gap: 8 }}>
        <Field label="Оплата" required>
          <Select options={Object.values(PaymentMethod).map((m) => ({ value: m, label: PaymentMethodLabel[m] }))} {...register('paymentMethod')} />
        </Field>
        <Field label="Доставка" required>
          <Select options={Object.values(DeliveryType).map((d) => ({ value: d, label: DeliveryTypeLabel[d] }))} {...register('deliveryType')} />
        </Field>
      </div>
      <Field label="Плановая дата">
        <Input type="date" {...register('plannedDate')} />
      </Field>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 'var(--fs-sm)' }}>Позиции</span>
          <Button size="sm" variant="secondary" type="button" onClick={() => append({ productId: '', quantity: 1 })}>+ Позиция</Button>
        </div>
        {errors.items?.message && <p style={{ color: 'var(--c-danger)', fontSize: 12 }}>{errors.items.message}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {fields.map((f, idx) => (
            <div key={f.id} style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
              <Field label={idx === 0 ? 'Фракция' : undefined} className="grow">
                <Select
                  placeholder="Продукт"
                  options={(products ?? []).map((p: ProductDto) => ({ value: p.id, label: `${p.name} (${money(p.price)})` }))}
                  value={items?.[idx]?.productId ?? ''}
                  onChange={(e) => onPickProduct(idx, e.target.value)}
                />
              </Field>
              <Field label={idx === 0 ? 'Кол-во, м³' : undefined}>
                <Input type="number" step="0.001" style={{ width: 90 }} {...register(`items.${idx}.quantity`, { valueAsNumber: true })} />
              </Field>
              {fields.length > 1 && (
                <Button size="sm" variant="ghost" type="button" aria-label="Убрать позицию" onClick={() => remove(idx)}><FiTrash2 /></Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 'var(--fs-lg)' }}>Итого: {money(total)}</div>
    </Modal>
  );
}

function OrderDetailModal({
  order,
  canEdit,
  onClose,
  onStatus,
  onDelete,
  busy,
}: {
  order: OrderDto;
  canEdit: boolean;
  onClose: () => void;
  onStatus: (s: OrderStatus) => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const transitions = NEXT_STATUS[order.status] ?? [];
  return (
    <Modal open onClose={onClose} title={`Заказ №${order.number}`} size="md">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{order.clientName}</span>
        <StatusChip value={order.status} label={OrderStatusLabel[order.status]} />
      </div>
      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--c-text-muted)' }}>
        {PaymentMethodLabel[order.paymentMethod]} · {DeliveryTypeLabel[order.deliveryType]} · {formatDate(order.createdAt)}
      </div>

      <table style={{ width: '100%', fontSize: 'var(--fs-sm)', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ color: 'var(--c-text-muted)', textAlign: 'left' }}>
            <th style={{ padding: '6px 0' }}>Фракция</th>
            <th style={{ textAlign: 'right' }}>Кол-во</th>
            <th style={{ textAlign: 'right' }}>Отгружено</th>
            <th style={{ textAlign: 'right' }}>Сумма</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((it) => (
            <tr key={it.id} style={{ borderTop: '1px solid var(--c-border)' }}>
              <td style={{ padding: '6px 0' }}>{it.productName}</td>
              <td className="tnum" style={{ textAlign: 'right' }}>{num(it.quantity)}</td>
              <td className="tnum" style={{ textAlign: 'right', color: it.shippedQty >= it.quantity ? 'var(--c-success)' : 'var(--c-text-muted)' }}>{num(it.shippedQty)}</td>
              <td className="tnum" style={{ textAlign: 'right' }}>{money(it.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ textAlign: 'right', fontWeight: 700 }}>Итого: {money(order.totalAmount)}</div>

      {canEdit && transitions.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {transitions.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={s === 'CANCELLED' ? 'danger' : 'primary'}
              loading={busy}
              onClick={() => onStatus(s)}
            >
              {OrderStatusLabel[s]}
            </Button>
          ))}
        </div>
      )}
      {canEdit && order.status === 'NEW' && (
        <Button variant="ghost" size="sm" onClick={onDelete} loading={busy}>Удалить заказ</Button>
      )}
      {order.status === 'CONFIRMED' || order.status === 'READY' || order.status === 'SHIPPING' ? (
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--c-text-dim)' }}>
          Отгрузка — в разделе «Талоны» (выберите этот заказ). {' '}
          <a href="/talons" onClick={(e) => { e.preventDefault(); toast.info('Откройте раздел «Талоны» и нажмите «Выдать талон»'); }} style={{ color: 'var(--c-accent)' }}>Перейти</a>
        </p>
      ) : null}
    </Modal>
  );
}
